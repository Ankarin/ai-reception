import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bookings, services } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  verifyWebhookSecret,
  unauthorizedResponse,
} from "@/lib/utils/webhook-auth";

const DEMO_ORG_ID = process.env.DEMO_ORG_ID || "";

export async function POST(request: NextRequest) {
  if (!verifyWebhookSecret(request)) return unauthorizedResponse();

  try {
    const body = await request.json();

    // ElevenLabs post-call webhook payload
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
              eq(services.organizationId, DEMO_ORG_ID),
              eq(services.name, service_name),
            ),
          );
        serviceId = svc?.id || null;
      }

      await db.insert(bookings).values({
        organizationId: DEMO_ORG_ID,
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
      `[ElevenLabs Webhook] Processed call ${body.call_id || "unknown"}`,
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ElevenLabs Webhook] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
