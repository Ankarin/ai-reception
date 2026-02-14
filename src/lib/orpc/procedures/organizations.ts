import { os } from "@orpc/server";
import * as z from "zod";
import { db } from "@/db";
import { organizations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { authMiddleware, requireOrgMiddleware } from "../middleware";

export const getOrganizations = os
  .use(authMiddleware)
  .use(requireOrgMiddleware)
  .handler(async ({ context }) => {
    const userOrganization = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, context.orgId))
      .limit(1);

    return userOrganization;
  });

export const getOrganization = os
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

    const organization = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, input.orgId))
      .limit(1);

    if (!organization[0]) {
      throw new Error("Organization not found");
    }

    return organization[0];
  });

export const updateOrganization = os
  .use(authMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      orgId: z.string(),
      name: z.string(),
      prompt: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    if (input.orgId !== context.orgId) {
      throw new Error(
        "Unauthorized: You don't have access to this organization",
      );
    }

    const updateData: any = {
      name: input.name,
      prompt: input.prompt || null,
      updatedAt: new Date(),
    };

    const updatedOrganization = await db
      .update(organizations)
      .set(updateData)
      .where(eq(organizations.id, input.orgId))
      .returning();

    if (!updatedOrganization[0]) {
      throw new Error("Organization not found");
    }

    return updatedOrganization[0];
  });

export const createOrganization = os
  .use(authMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      name: z.string(),
      prompt: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const existing = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, context.orgId))
      .limit(1);

    if (existing.length > 0) {
      throw new Error("Organization already exists");
    }

    const newOrganization = await db
      .insert(organizations)
      .values({
        id: context.orgId,
        name: input.name,
        prompt: input.prompt || null,
      })
      .returning();

    return newOrganization[0];
  });
