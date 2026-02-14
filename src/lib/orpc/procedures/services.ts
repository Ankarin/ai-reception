import { os } from "@orpc/server";
import * as z from "zod";
import { db } from "@/db";
import { services } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { authMiddleware, requireOrgMiddleware } from "../middleware";

export const getServices = os
  .use(authMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      orgId: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    if (input.orgId !== context.orgId) {
      throw new Error("Unauthorized: You don't have access to this organization");
    }

    return db
      .select()
      .from(services)
      .where(eq(services.organizationId, input.orgId))
      .orderBy(desc(services.createdAt));
  });

export const createService = os
  .use(authMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      orgId: z.string(),
      name: z.string().min(1),
      description: z.string().optional(),
      price: z.number().min(0),
      duration: z.number().min(5),
    }),
  )
  .handler(async ({ input, context }) => {
    if (input.orgId !== context.orgId) {
      throw new Error("Unauthorized: You don't have access to this organization");
    }

    const [newService] = await db
      .insert(services)
      .values({
        organizationId: input.orgId,
        name: input.name,
        description: input.description || null,
        price: input.price,
        duration: input.duration,
      })
      .returning();

    return newService;
  });

export const updateService = os
  .use(authMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      orgId: z.string(),
      id: z.string().uuid(),
      name: z.string().min(1).optional(),
      description: z.string().nullable().optional(),
      price: z.number().min(0).optional(),
      duration: z.number().min(5).optional(),
      isActive: z.number().min(0).max(1).optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    if (input.orgId !== context.orgId) {
      throw new Error("Unauthorized: You don't have access to this organization");
    }

    const { orgId, id, ...updateData } = input;
    const [updated] = await db
      .update(services)
      .set({ ...updateData, updatedAt: new Date() })
      .where(and(eq(services.id, id), eq(services.organizationId, orgId)))
      .returning();

    if (!updated) throw new Error("Service not found");
    return updated;
  });

export const deleteService = os
  .use(authMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      orgId: z.string(),
      id: z.string().uuid(),
    }),
  )
  .handler(async ({ input, context }) => {
    if (input.orgId !== context.orgId) {
      throw new Error("Unauthorized: You don't have access to this organization");
    }

    const [deleted] = await db
      .delete(services)
      .where(and(eq(services.id, input.id), eq(services.organizationId, input.orgId)))
      .returning();

    if (!deleted) throw new Error("Service not found");
    return { success: true };
  });
