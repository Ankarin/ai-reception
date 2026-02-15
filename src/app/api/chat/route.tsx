import type { NextRequest } from "next/server";

import {
  convertToModelMessages,
  createIdGenerator,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import { db } from "@/db";
import { chats, organizations } from "@/db/schema";
import { CHAT_CONFIG } from "@/lib/chat/constants";
import { createChatTools } from "@/lib/chat/tool-factory";
import { createCORSResponse, createCORSStreamResponse } from "@/lib/utils/cors";

const MAX_MESSAGES_IN_MEMORY = 20;

export const GET = async () => {
  return createCORSResponse({ status: "ok", message: "Chat API is running" });
};

export const OPTIONS = async () => {
  return createCORSResponse(null, 200);
};

export const POST = async (req: NextRequest) => {
  const startTime = performance.now();
  const timings: Record<string, number | boolean> = {};

  try {
    const authHeader = req.headers.get("authorization");
    let jwtPayload: any = null;

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      try {
        jwtPayload = JSON.parse(atob(token.split(".")[1]));
      } catch (e) {
        console.warn("⚠️ [Chat API] Failed to decode JWT:", e);
      }
    }

    const body = await req.json();
    timings.bodyParse = performance.now() - startTime;

    const { message, id, orgId, customerName, isTest, createOnly } = body as {
      message: UIMessage;
      id: string;
      orgId?: string;
      customerName?: string;
      isTest?: boolean;
      createOnly?: boolean;
    };

    if (!id || id.trim() === "") {
      return createCORSResponse({ error: "Chat ID is required" }, 400);
    }

    let actualChatId = id;
    if (id === "_") {
      actualChatId = uuidv4();
    }

    let chat = null;
    let organization = null;

    if (id !== "_") {
      const chatLookupStart = performance.now();
      chat = await db.query.chats.findFirst({
        where: eq(chats.id, actualChatId),
        with: { organization: true },
      });
      timings.chatLookup = performance.now() - chatLookupStart;

      if (chat?.organization) {
        organization = chat.organization;
      }
    }

    if (!chat && orgId) {
      const now = new Date();
      const newChatStart = performance.now();

      // Run org fetch and chat insert in parallel for faster first message
      const [insertResult, fetchedOrg] = await Promise.all([
        db
          .insert(chats)
          .values({
            id: actualChatId,
            organizationId: orgId,
            messages: [],
            customerName: customerName || jwtPayload?.name || null,
            isTest: isTest ? 1 : 0,
          })
          .catch((err) => {
            // FK constraint will fail if org doesn't exist
            console.error("❌ [Chat API] Insert failed:", err);
            return null;
          }),
        db.query.organizations.findFirst({
          where: eq(organizations.id, orgId),
        }),
      ]);
      timings.newChatCreation = performance.now() - newChatStart;

      organization = fetchedOrg;

      if (!organization || !insertResult) {
        return createCORSResponse({ error: "Organization not found" }, 404);
      }

      // Construct chat object directly instead of querying again
      chat = {
        id: actualChatId,
        organizationId: orgId,
        messages: [] as any[],
        customerName: customerName || jwtPayload?.name || null,
        customerPhone: null,
        customerEmail: null,
        isTest: isTest ? 1 : 0,
        messageCount: 0,
        createdAt: now,
        updatedAt: now,
      };
    }

    if (createOnly) {
      return createCORSResponse({ success: true, chat });
    }

    if (!chat || !organization) {
      return createCORSResponse(
        { error: "Chat or organization not found" },
        404,
      );
    }
    const allMessages = (chat.messages as UIMessage[]) || [];

    const history =
      allMessages.length > MAX_MESSAGES_IN_MEMORY
        ? allMessages.slice(-MAX_MESSAGES_IN_MEMORY)
        : allMessages;

    const messages = [...history, message];

    const customPrompt =
      typeof organization.prompt === "string" ? organization.prompt : null;
    const tools = createChatTools(actualChatId, organization.id, 2);

    const basePrompt =
      customPrompt ||
      "You are a friendly and professional AI receptionist for a dental clinic. You help patients learn about dental services, check appointment availability, and book appointments. Be warm, reassuring, and informative.";
    const now = new Date();
    const toolInstructions = `

IMPORTANT INSTRUCTIONS — you MUST follow these:
- Current date and time: ${now.toISOString()} (${now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}, ${now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}). Use this to understand relative dates like "today", "tomorrow", "next Monday", etc.
- You have tools available: listServices, checkAvailability, createBooking, lookupBooking, updateBooking. You MUST use them — never pretend to do something without calling the actual tool.
- To book an appointment: collect patient's full name, phone number, preferred date/time and service, then call checkAvailability, then call createBooking. Do NOT say a booking is made unless createBooking returned success.
- For createBooking arguments, use: patientName, patientPhone, date, time, and optional serviceId (or serviceName) and notes.
- To look up a booking: ALWAYS ask for both the patient's name AND phone number. Pass both to lookupBooking — some bookings may not have a phone stored.
- To reschedule: call lookupBooking (with both name and phone) first to find the booking, then call updateBooking with action "reschedule".
- To cancel: call lookupBooking (with both name and phone) first, then call updateBooking with action "cancel".
- NEVER hallucinate or fabricate booking confirmations. NEVER say you "forwarded to admin" — use the tools directly.`;
    const systemPrompt = `${basePrompt}\n${toolInstructions}`;

    timings.preStream = performance.now() - startTime;
    const streamStart = performance.now();

    const result = streamText({
      model: "anthropic/claude-haiku-4.5",
      messages: convertToModelMessages(messages),
      system: systemPrompt,
      tools,
      stopWhen: stepCountIs(10),
    });

    const response = result.toUIMessageStreamResponse({
      originalMessages: messages,
      generateMessageId: createIdGenerator({
        prefix: CHAT_CONFIG.MESSAGE_ID_PREFIX,
        size: CHAT_CONFIG.MESSAGE_ID_SIZE,
      }),
      onFinish: async ({ messages: finalMessages }) => {
        const dbUpdateStart = performance.now();
        await db
          .update(chats)
          .set({
            messages: finalMessages,
            messageCount: finalMessages.length,
            updatedAt: new Date(),
          })
          .where(eq(chats.id, actualChatId));

        timings.dbUpdate = performance.now() - dbUpdateStart;
        timings.streamDuration = performance.now() - streamStart;
        timings.total = performance.now() - startTime;

        console.log(`⏱️ [Chat API] Performance:`, {
          chatId: actualChatId,
          isNewChat: id === "_" || !timings.chatLookup,
          timings: Object.fromEntries(
            Object.entries(timings).map(([k, v]) => [
              k,
              typeof v === "number" ? `${v.toFixed(1)}ms` : v,
            ]),
          ),
        });
      },
    });

    console.log(
      `⏱️ [Chat API] TTFB: ${(timings.preStream as number).toFixed(1)}ms`,
      {
        chatId: actualChatId,
        isNewChat: id === "_" || !timings.chatLookup,
      },
    );

    return createCORSStreamResponse(response);
  } catch (error) {
    console.error("❌ [Chat API] Error:", error);
    return createCORSResponse(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};
