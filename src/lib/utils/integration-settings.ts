import { db } from "@/db";
import { integrationSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function getOrgIntegrationSettings(orgId: string) {
  const [settings] = await db
    .select()
    .from(integrationSettings)
    .where(eq(integrationSettings.organizationId, orgId))
    .limit(1);

  return settings || null;
}

export function verifyOrgWebhookSecret(
  request: Request,
  expectedSecret: string | null,
): boolean {
  if (!expectedSecret) return true;

  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${expectedSecret}`) return true;

  const webhookHeader = request.headers.get("x-webhook-secret");
  if (webhookHeader === expectedSecret) return true;

  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");
  if (querySecret === expectedSecret) return true;

  return false;
}
