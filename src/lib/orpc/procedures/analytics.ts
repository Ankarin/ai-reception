import { os } from "@orpc/server";
import * as z from "zod";
import { db } from "@/db";
import { chats } from "@/db/schema";
import { eq, and, sql, desc, gte } from "drizzle-orm";
import { authMiddleware, requireOrgMiddleware } from "../middleware";

export const getAnalytics = os
  .use(authMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      orgId: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    if (input.orgId !== context.orgId) {
      throw new Error(
        "Unauthorized: You don't have access to this organization",
      );
    }

    const [totalChatsResult, oldestChatResult] = await Promise.all([
      db
        .select({
          count: sql<number>`count(*)::int`,
          messageCount: sql<number>`coalesce(sum(${chats.messageCount}), 0)::int`,
        })
        .from(chats)
        .where(
          and(
            eq(chats.organizationId, input.orgId),
            eq(chats.isTest, 0),
          ),
        ),

      db
        .select({
          createdAt: chats.createdAt,
        })
        .from(chats)
        .where(
          and(
            eq(chats.organizationId, input.orgId),
            eq(chats.isTest, 0),
          ),
        )
        .orderBy(chats.createdAt)
        .limit(1),
    ]);

    const totalChats = totalChatsResult[0]?.count || 0;
    const totalMessages = totalChatsResult[0]?.messageCount || 0;
    const startDate = oldestChatResult[0]?.createdAt || new Date();

    return {
      period: {
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
      },
      metrics: {
        totalChats,
        totalMessages,
      },
    };
  });

