import type { NextRequest } from "next/server";

import { db } from "@/db";
import { chats } from "@/db/schema";
import { createCORSResponse } from "@/lib/utils/cors";

export async function OPTIONS() {
  return createCORSResponse(null, 200);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const body = await request.json();

    const { customerName, isTest } = body;

    const newChat = await db
      .insert(chats)
      .values({
        organizationId: orgId,
        customerName: customerName || null,
        isTest: isTest ? 1 : 0,
      })
      .returning();

    return createCORSResponse(newChat[0]);
  } catch (error) {
    console.error("❌ [Create Chat] Error creating chat:", error);
    return createCORSResponse(
      {
        error: "Failed to create chat",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
}
