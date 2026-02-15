import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bookings, services } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  getOrgIntegrationSettings,
  verifyOrgWebhookSecret,
} from "@/lib/utils/integration-settings";
import { unauthorizedResponse } from "@/lib/utils/webhook-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;

  const settings = await getOrgIntegrationSettings(orgId);
  if (!settings || !settings.elevenlabsEnabled) {
    return NextResponse.json({ error: "Integration not enabled" }, { status: 404 });
  }

  if (!verifyOrgWebhookSecret(request, settings.webhookSecret)) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();

    const { call_id, transcript, extracted_data } = body;

    if (extracted_data?.booking) {
      const { patient_name, patient_phone, date, time, service_name } =
        extracted_data.booking;

      let serviceId = null;
      if (service_name) {
        const [svc] = await db
          .select()
          .from(services)
          .where(
            and(
              eq(services.organizationId, orgId),
              eq(services.name, service_name),
            ),
          );
        serviceId = svc?.id || null;
      }

      await db.insert(bookings).values({
        organizationId: orgId,
        serviceId,
        patientName: patient_name || "Voice Call Patient",
        patientPhone: patient_phone || null,
        date: date || new Date().toISOString().split("T")[0],
        time: time || "09:00",
        notes: `ElevenLabs call ${call_id || "unknown"}`,
        source: "elevenlabs",
      });
    }

    console.log(
      `[ElevenLabs Webhook] Org ${orgId} | Processed call ${body.call_id || "unknown"}`,
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ElevenLabs Webhook] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
