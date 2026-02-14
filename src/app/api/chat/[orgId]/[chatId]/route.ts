import { eq } from "drizzle-orm";

import { db } from "@/db";
import { chats } from "@/db/schema";
import { createCORSResponse } from "@/lib/utils/cors";

export async function OPTIONS() {
  return createCORSResponse(null, 200);
}

export async function GET(
  _: unknown,
  { params }: { params: Promise<{ orgId: string; chatId: string }> },
) {
  try {
    const { orgId, chatId } = await params;

    if (chatId === "_" || !chatId) {
      return createCORSResponse({ error: "Chat not found" }, 404);
    }

    const chat = await db
      .select({
        customerName: chats.customerName,
        messages: chats.messages,
        updatedAt: chats.updatedAt,
      })
      .from(chats)
      .where(eq(chats.id, chatId))
      .limit(1);

    if (!chat[0]) {
      return createCORSResponse({ error: "Chat not found" }, 404);
    }

    return createCORSResponse({
      orgId,
      chatId,
      status: "active",
      messages: chat[0].messages || [],
      customerName: chat[0].customerName || null,
      updatedAt: chat[0].updatedAt || null,
    });
  } catch (error) {
    console.error("❌ [Get Chat] Error fetching chat:", error);
    return createCORSResponse(
      {
        error: "Failed to fetch chat",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
}
