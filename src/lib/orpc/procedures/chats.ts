import { os } from "@orpc/server";
import * as z from "zod";
import { db } from "@/db";
import { chats, organizations } from "@/db/schema";
import { eq, desc, asc, and, or, ilike, sql, count } from "drizzle-orm";
import { authMiddleware, requireOrgMiddleware } from "../middleware";

export const getChats = os
  .use(authMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      orgId: z.string(),
      sortBy: z
        .enum(["createdAt", "updatedAt"])
        .optional()
        .default("updatedAt"),
      sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
      search: z.string().optional(),
      page: z.number().min(1).optional().default(1),
      pageSize: z.number().min(1).max(100).optional().default(20),
    }),
  )
  .handler(async ({ input, context }) => {
    if (input.orgId !== context.orgId) {
      throw new Error(
        "Unauthorized: You don't have access to this organization",
      );
    }

    const conditions = [
      eq(chats.organizationId, input.orgId),
      eq(chats.isTest, 0),
    ];

    if (input.search) {
      const searchPattern = `%${input.search}%`;
      const searchCondition = or(
        ilike(chats.customerName, searchPattern),
        ilike(chats.customerPhone, searchPattern),
        ilike(chats.customerEmail, searchPattern),
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    const whereClause = and(...conditions);

    const [totalResult] = await db
      .select({ count: count() })
      .from(chats)
      .where(whereClause);

    const total = totalResult?.count || 0;

    const sortColumn =
      input.sortBy === "createdAt" ? chats.createdAt : chats.updatedAt;

    const orderFn = input.sortOrder === "asc" ? asc : desc;

    const offset = (input.page - 1) * input.pageSize;

    const organizationChats = await db
      .select()
      .from(chats)
      .where(whereClause)
      .orderBy(orderFn(sortColumn))
      .limit(input.pageSize)
      .offset(offset);

    return {
      chats: organizationChats,
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        total,
        totalPages: Math.ceil(total / input.pageSize),
      },
    };
  });

export const createChat = os
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

    const newChat = await db
      .insert(chats)
      .values({
        organizationId: input.orgId,
      })
      .returning();

    return newChat[0];
  });

export const updateChatContact = os
  .use(authMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      orgId: z.string(),
      chatId: z.string().uuid(),
      customerPhone: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    if (input.orgId !== context.orgId) {
      throw new Error(
        "Unauthorized: You don't have access to this organization",
      );
    }

    if (!input.customerPhone) {
      throw new Error(
        "customerPhone is required",
      );
    }

    const updateData: any = {};
    if (input.customerPhone) updateData.customerPhone = input.customerPhone;

    const [updatedChat] = await db
      .update(chats)
      .set(updateData)
      .where(eq(chats.id, input.chatId))
      .returning();

    if (!updatedChat) {
      throw new Error("Chat not found");
    }

    return updatedChat;
  });
