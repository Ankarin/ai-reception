import { os } from "@orpc/server";
import * as z from "zod";
import { db } from "@/db";
import { integrationSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { authMiddleware, requireOrgMiddleware, requireAdminMiddleware } from "../middleware";

type TelegramWebhookAction = "none" | "set" | "delete";

type TelegramWebhookSyncResult = {
  attempted: boolean;
  success: boolean;
  action: TelegramWebhookAction;
  url: string | null;
  error: string | null;
};

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function buildTelegramWebhookUrl(
  baseUrl: string,
  orgId: string,
  webhookSecret: string,
): string {
  const normalized = normalizeBaseUrl(baseUrl);
  return `${normalized}/api/webhooks/telegram/${orgId}?secret=${encodeURIComponent(webhookSecret)}`;
}

async function callTelegramApi(
  botToken: string,
  method: "setWebhook" | "deleteWebhook",
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; description?: string; errorCode?: number }> {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const raw = (await response.json().catch(() => null)) as {
    ok?: boolean;
    description?: string;
    error_code?: number;
  } | null;

  return {
    ok: Boolean(response.ok && raw?.ok),
    description: raw?.description,
    errorCode: raw?.error_code,
  };
}

async function syncTelegramWebhook(params: {
  orgId: string;
  baseUrl?: string | null;
  telegramEnabled: number;
  telegramBotToken: string | null;
  webhookSecret: string | null;
}): Promise<TelegramWebhookSyncResult> {
  const { orgId, baseUrl, telegramEnabled, telegramBotToken, webhookSecret } =
    params;

  if (!telegramBotToken) {
    return {
      attempted: false,
      success: true,
      action: "none",
      url: null,
      error: null,
    };
  }

  if (telegramEnabled === 0) {
    try {
      const result = await callTelegramApi(telegramBotToken, "deleteWebhook", {
        drop_pending_updates: false,
      });

      if (!result.ok) {
        return {
          attempted: true,
          success: false,
          action: "delete",
          url: null,
          error:
            result.description ||
            "Telegram deleteWebhook failed for an unknown reason.",
        };
      }

      return {
        attempted: true,
        success: true,
        action: "delete",
        url: null,
        error: null,
      };
    } catch (error) {
      return {
        attempted: true,
        success: false,
        action: "delete",
        url: null,
        error:
          error instanceof Error
            ? error.message
            : "Failed to call Telegram deleteWebhook.",
      };
    }
  }

  if (!baseUrl) {
    return {
      attempted: false,
      success: false,
      action: "set",
      url: null,
      error: "Base URL is required to auto-sync Telegram webhook.",
    };
  }

  if (!webhookSecret) {
    return {
      attempted: false,
      success: false,
      action: "set",
      url: null,
      error: "Webhook secret is required to auto-sync Telegram webhook.",
    };
  }

  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  if (!normalizedBaseUrl.startsWith("https://")) {
    return {
      attempted: false,
      success: false,
      action: "set",
      url: null,
      error: "Base URL must use HTTPS for Telegram webhook sync.",
    };
  }

  const webhookUrl = buildTelegramWebhookUrl(
    normalizedBaseUrl,
    orgId,
    webhookSecret,
  );

  try {
    const result = await callTelegramApi(telegramBotToken, "setWebhook", {
      url: webhookUrl,
    });

    if (!result.ok) {
      return {
        attempted: true,
        success: false,
        action: "set",
        url: webhookUrl,
        error:
          result.description || "Telegram setWebhook failed for an unknown reason.",
      };
    }

    return {
      attempted: true,
      success: true,
      action: "set",
      url: webhookUrl,
      error: null,
    };
  } catch (error) {
    return {
      attempted: true,
      success: false,
      action: "set",
      url: webhookUrl,
      error:
        error instanceof Error
          ? error.message
          : "Failed to call Telegram setWebhook.",
    };
  }
}

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
      baseUrl: z.string().url().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    if (input.orgId !== context.orgId) {
      throw new Error("Unauthorized: You don't have access to this organization");
    }

    const { orgId, baseUrl, ...updateData } = input;

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

      const telegramWebhookSync = await syncTelegramWebhook({
        orgId,
        baseUrl,
        telegramEnabled: updated.telegramEnabled,
        telegramBotToken: updated.telegramBotToken,
        webhookSecret: updated.webhookSecret,
      });

      return {
        ...updated,
        telegramWebhookSync,
      };
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

    const telegramWebhookSync = await syncTelegramWebhook({
      orgId,
      baseUrl,
      telegramEnabled: created.telegramEnabled,
      telegramBotToken: created.telegramBotToken,
      webhookSecret: created.webhookSecret,
    });

    return {
      ...created,
      telegramWebhookSync,
    };
  });
