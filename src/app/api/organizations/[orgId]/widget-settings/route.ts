import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { widgetSettings } from "@/db/schema";
import { DEFAULT_WIDGET_CONFIG } from "@/lib/widget/defaults";
import { createCORSResponse } from "@/lib/utils/cors";

export async function OPTIONS() {
  return createCORSResponse(null, 200);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;

    const settings = await db
      .select()
      .from(widgetSettings)
      .where(eq(widgetSettings.organizationId, orgId))
      .limit(1);

    if (settings.length === 0) {
      return createCORSResponse(DEFAULT_WIDGET_CONFIG);
    }

    const setting = settings[0];

    const normalizedSetting = {
      ...setting,
      showBranding: setting.showBranding === 1,
      enableQuickReplies: setting.enableQuickReplies === 1,
      enableTimeTrigger: setting.enableTimeTrigger === 1,
    };

    return createCORSResponse(normalizedSetting);
  } catch (error) {
    console.error("Error fetching widget settings:", error);
    return createCORSResponse(
      { error: "Failed to fetch widget settings" },
      500,
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId: userOrgId, orgRole } = await auth();
    const { orgId } = await params;

    if (!userOrgId || userOrgId !== orgId) {
      return NextResponse.json(
        { error: "Unauthorized: You don't have access to this organization" },
        { status: 403 },
      );
    }

    if (orgRole !== "org:admin") {
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 },
      );
    }

    const body = await request.json();

    const {
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      id: _id,
      ...settingsData
    } = body;

    const normalizedData = {
      ...settingsData,
      showBranding:
        typeof settingsData.showBranding === "boolean"
          ? settingsData.showBranding
            ? 1
            : 0
          : settingsData.showBranding,
      enableQuickReplies:
        typeof settingsData.enableQuickReplies === "boolean"
          ? settingsData.enableQuickReplies
            ? 1
            : 0
          : settingsData.enableQuickReplies,
      enableTimeTrigger:
        typeof settingsData.enableTimeTrigger === "boolean"
          ? settingsData.enableTimeTrigger
            ? 1
            : 0
          : settingsData.enableTimeTrigger,
    };

    const existing = await db
      .select()
      .from(widgetSettings)
      .where(eq(widgetSettings.organizationId, orgId))
      .limit(1);

    if (existing.length > 0) {
      const updated = await db
        .update(widgetSettings)
        .set({
          ...normalizedData,
          updatedAt: new Date(),
        })
        .where(eq(widgetSettings.organizationId, orgId))
        .returning();

      return NextResponse.json(updated[0]);
    } else {
      const created = await db
        .insert(widgetSettings)
        .values({
          organizationId: orgId,
          ...normalizedData,
        })
        .returning();

      return NextResponse.json(created[0]);
    }
  } catch (error) {
    console.error("Error saving widget settings:", error);
    return NextResponse.json(
      { error: "Failed to save widget settings" },
      { status: 500 },
    );
  }
}
