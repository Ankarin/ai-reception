import { os } from "@orpc/server";
import * as z from "zod";
import { db } from "@/db";
import { integrationSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { authMiddleware, requireOrgMiddleware, requireAdminMiddleware } from "../middleware";

export const getIntegrationSettings = os
  .use(authMiddleware)
  .use(requireOrgMiddleware)
  .use(requireAdminMiddleware)
  .input(
    z.object({
      orgId: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    if (input.orgId !== context.orgId) {
      throw new Error("Unauthorized: You don't have access to this organization");
    }

    const [existing] = await db
      .select()
      .from(integrationSettings)
      .where(eq(integrationSettings.organizationId, input.orgId))
      .limit(1);

    if (!existing) {
      return {
        telegramBotToken: null as string | null,
        telegramEnabled: 0,
        resendApiKey: null as string | null,
        emailEnabled: 0,
        elevenlabsEnabled: 0,
        webhookSecret: null as string | null,
      };
    }

    return {
      telegramBotToken: existing.telegramBotToken,
      telegramEnabled: existing.telegramEnabled,
      resendApiKey: existing.resendApiKey,
      emailEnabled: existing.emailEnabled,
      elevenlabsEnabled: existing.elevenlabsEnabled,
      webhookSecret: existing.webhookSecret,
    };
  });

export const updateIntegrationSettings = os
  .use(authMiddleware)
  .use(requireOrgMiddleware)
  .use(requireAdminMiddleware)
  .input(
    z.object({
      orgId: z.string(),
      telegramBotToken: z.string().nullable().optional(),
      telegramEnabled: z.number().min(0).max(1).optional(),
      resendApiKey: z.string().nullable().optional(),
      emailEnabled: z.number().min(0).max(1).optional(),
      elevenlabsEnabled: z.number().min(0).max(1).optional(),
      webhookSecret: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    if (input.orgId !== context.orgId) {
      throw new Error("Unauthorized: You don't have access to this organization");
    }

    const { orgId, ...updateData } = input;

    const [existing] = await db
      .select()
      .from(integrationSettings)
      .where(eq(integrationSettings.organizationId, orgId))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(integrationSettings)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(integrationSettings.organizationId, orgId))
        .returning();
      return updated;
    }

    const webhookSecret = updateData.webhookSecret || crypto.randomUUID();
    const [created] = await db
      .insert(integrationSettings)
      .values({
        organizationId: orgId,
        ...updateData,
        webhookSecret,
      })
      .returning();
    return created;
  });
