import { type NextRequest, NextResponse } from "next/server";
import { generateText, stepCountIs, type CoreMessage } from "ai";
import { db } from "@/db";
import { chats, organizations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createChatTools } from "@/lib/chat/tool-factory";
import {
  getOrgIntegrationSettings,
  verifyOrgWebhookSecret,
} from "@/lib/utils/integration-settings";
import { unauthorizedResponse } from "@/lib/utils/webhook-auth";

const MAX_HISTORY = 20;

/**
 * Deterministic UUID for a Telegram chat scoped to an org.
 * Incorporates orgId hash to avoid collisions across orgs.
 */
function stableChatId(orgId: string, telegramChatId: number): string {
  let hash = 0;
  for (const ch of orgId) {
    hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
  }
  const orgHash = Math.abs(hash).toString(16).padStart(8, "0").slice(0, 8);
  const tgId = telegramChatId.toString().padStart(12, "0").slice(0, 12);
  return `${orgHash}-0000-4000-8000-${tgId}`;
}

async function getOrCreateChat(orgId: string, telegramChatId: number, userName?: string) {
  const id = stableChatId(orgId, telegramChatId);

  const existing = await db.query.chats.findFirst({
    where: eq(chats.id, id),
    with: { organization: true },
  });

  if (existing) return existing;

  await db.insert(chats).values({
    id,
    organizationId: orgId,
    customerName: userName || `Telegram ${telegramChatId}`,
    messages: [],
    isTest: 0,
  });

  return db.query.chats.findFirst({
    where: eq(chats.id, id),
    with: { organization: true },
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;

  const settings = await getOrgIntegrationSettings(orgId);
  if (!settings || !settings.telegramEnabled) {
    return NextResponse.json({ error: "Integration not enabled" }, { status: 404 });
  }

  if (!verifyOrgWebhookSecret(request, settings.webhookSecret)) {
    return unauthorizedResponse();
  }

  const botToken = settings.telegramBotToken;
  if (!botToken) {
    return NextResponse.json({ error: "Bot token not configured" }, { status: 500 });
  }

  try {
    const update = await request.json();

    const message = update.message;
    if (!message?.text || !message.chat?.id) {
      return NextResponse.json({ ok: true });
    }

    const telegramChatId = message.chat.id;
    const userText = message.text;

    if (userText === "/start") {
      await sendTelegramMessage(
        botToken,
        telegramChatId,
        "Привіт! Я AI-рецепціоніст клініки. Я можу допомогти вам з:\n\n- Переліком послуг та цінами\n- Перевіркою вільного часу для запису\n- Записом на прийом\n- Пошуком ваших існуючих записів\n\nЧим можу допомогти вам сьогодні?",
      );
      return NextResponse.json({ ok: true });
    }

    const userName =
      [message.from?.first_name, message.from?.last_name]
        .filter(Boolean)
        .join(" ") || undefined;

    const chat = await getOrCreateChat(orgId, telegramChatId, userName);
    if (!chat) {
      console.error("[Telegram] Failed to get/create chat");
      return NextResponse.json({ ok: true });
    }

    const org = chat.organization;
    const now = new Date();
    const basePrompt = org?.prompt ||
      "You are a friendly and professional AI receptionist. Help patients with services, availability, and bookings.";
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

    const storedMessages = (chat.messages as CoreMessage[]) || [];
    const history =
      storedMessages.length > MAX_HISTORY
        ? storedMessages.slice(-MAX_HISTORY)
        : storedMessages;

    const newUserMessage: CoreMessage = { role: "user", content: userText };
    const allMessages = [...history, newUserMessage];

    const tools = createChatTools(chat.id, orgId);

    const result = await generateText({
      model: "google/gemini-3-flash",
      system: systemPrompt,
      messages: allMessages,
      tools,
      stopWhen: stepCountIs(5),
    });

    const assistantMessage: CoreMessage = {
      role: "assistant",
      content: result.text,
    };
    const updatedMessages = [...allMessages, assistantMessage];

    await db
      .update(chats)
      .set({
        messages: updatedMessages,
        messageCount: updatedMessages.length,
        customerName: userName || chat.customerName,
        updatedAt: new Date(),
      })
      .where(eq(chats.id, chat.id));

    if (result.text) {
      await sendTelegramMessage(botToken, telegramChatId, result.text);
    }

    console.log(
      `[Telegram] Org ${orgId} | Chat ${telegramChatId} | ${updatedMessages.length} msgs`,
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Telegram Webhook] Error:", error);
    return NextResponse.json({ ok: true });
  }
}

async function sendTelegramMessage(botToken: string, chatId: number, text: string) {
  const chunks = splitMessage(text, 4096);

  for (const chunk of chunks) {
    const markdownResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: chunk,
          parse_mode: "Markdown",
        }),
      },
    );

    const markdownResult = (await markdownResponse
      .json()
      .catch(() => null)) as { ok?: boolean; description?: string } | null;

    if (markdownResponse.ok && markdownResult?.ok) {
      continue;
    }

    // Fallback for formatting errors: resend plain text when Markdown parsing fails.
    const plainResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: chunk,
        }),
      },
    );

    const plainResult = (await plainResponse
      .json()
      .catch(() => null)) as { ok?: boolean; description?: string } | null;

    if (!(plainResponse.ok && plainResult?.ok)) {
      console.error("[Telegram] sendMessage failed", {
        chatId,
        markdownError: markdownResult?.description || "unknown",
        plainError: plainResult?.description || "unknown",
      });
    }
  }
}

function splitMessage(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }
    let splitIdx = remaining.lastIndexOf("\n", maxLength);
    if (splitIdx < maxLength / 2) splitIdx = maxLength;
    chunks.push(remaining.slice(0, splitIdx));
    remaining = remaining.slice(splitIdx).trimStart();
  }
  return chunks;
}
