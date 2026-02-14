import { type NextRequest, NextResponse } from "next/server";
import { generateText, type CoreMessage } from "ai";
import { db } from "@/db";
import { chats, organizations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createChatTools } from "@/lib/chat/tool-factory";
import {
  verifyWebhookSecret,
  unauthorizedResponse,
} from "@/lib/utils/webhook-auth";

const DEMO_ORG_ID = process.env.DEMO_ORG_ID || "demo-dental-clinic";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const MAX_HISTORY = 20;

/**
 * Get or create a chat record for this Telegram user.
 * Uses a deterministic UUID derived from the Telegram chat ID
 * so the same user always maps to the same conversation.
 */
async function getOrCreateChat(telegramChatId: number, userName?: string) {
  const stableId = `00000000-0000-4000-8000-${telegramChatId.toString().padStart(12, "0")}`;

  const existing = await db.query.chats.findFirst({
    where: eq(chats.id, stableId),
    with: { organization: true },
  });

  if (existing) return existing;

  await db.insert(chats).values({
    id: stableId,
    organizationId: DEMO_ORG_ID,
    customerName: userName || `Telegram ${telegramChatId}`,
    messages: [],
    isTest: 0,
  });

  return db.query.chats.findFirst({
    where: eq(chats.id, stableId),
    with: { organization: true },
  });
}

export async function POST(request: NextRequest) {
  if (!verifyWebhookSecret(request)) return unauthorizedResponse();

  try {
    const update = await request.json();

    const message = update.message;
    if (!message?.text || !message.chat?.id) {
      return NextResponse.json({ ok: true });
    }

    const telegramChatId = message.chat.id;
    const userText = message.text;

    // Handle /start command
    if (userText === "/start") {
      if (TELEGRAM_BOT_TOKEN) {
        await sendTelegramMessage(
          telegramChatId,
          "Hi! 👋 I'm the AI receptionist for SmileDent Dental Clinic. I can help you with:\n\n• View our services and pricing\n• Check appointment availability\n• Book an appointment\n• Look up your existing bookings\n\nHow can I help you today?",
        );
      }
      return NextResponse.json({ ok: true });
    }

    // Get or create persistent chat (like the widget does)
    const userName =
      [message.from?.first_name, message.from?.last_name]
        .filter(Boolean)
        .join(" ") || undefined;

    const chat = await getOrCreateChat(telegramChatId, userName);
    if (!chat) {
      console.error("[Telegram] Failed to get/create chat");
      return NextResponse.json({ ok: true });
    }

    const org = chat.organization;
    const systemPrompt =
      org?.prompt ||
      "You are a friendly and professional AI receptionist for a dental clinic. Help patients with services, availability, and bookings.";

    // Load conversation history from DB (same as widget)
    const storedMessages = (chat.messages as CoreMessage[]) || [];
    const history =
      storedMessages.length > MAX_HISTORY
        ? storedMessages.slice(-MAX_HISTORY)
        : storedMessages;

    const newUserMessage: CoreMessage = { role: "user", content: userText };
    const allMessages = [...history, newUserMessage];

    const tools = createChatTools(chat.id, DEMO_ORG_ID);

    // Generate with full conversation history
    const result = await generateText({
      model: "google/gemini-3-flash",
      system: systemPrompt,
      messages: allMessages,
      tools,
      maxSteps: 5,
    });

    // Persist updated conversation to DB
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

    // Send response to Telegram
    if (TELEGRAM_BOT_TOKEN && result.text) {
      await sendTelegramMessage(telegramChatId, result.text);
    }

    console.log(
      `[Telegram] Chat ${telegramChatId} | ${updatedMessages.length} msgs`,
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Telegram Webhook] Error:", error);
    return NextResponse.json({ ok: true }); // Always 200 to Telegram
  }
}

async function sendTelegramMessage(chatId: number, text: string) {
  const chunks = splitMessage(text, 4096);

  for (const chunk of chunks) {
    try {
      await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
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
    } catch {
      // Retry without Markdown if parse fails
      await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: chunk,
          }),
        },
      );
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
