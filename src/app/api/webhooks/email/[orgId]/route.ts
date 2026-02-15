import { type NextRequest, NextResponse } from "next/server";
import { generateText, stepCountIs } from "ai";
import { db } from "@/db";
import { organizations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createChatTools } from "@/lib/chat/tool-factory";
import {
  getOrgIntegrationSettings,
  verifyOrgWebhookSecret,
} from "@/lib/utils/integration-settings";
import { unauthorizedResponse } from "@/lib/utils/webhook-auth";

async function fetchResendEmailBody(
  emailId: string,
  apiKey: string,
): Promise<{ text: string | null; from: string; subject: string } | null> {
  if (!apiKey) return null;

  const res = await fetch(
    `https://api.resend.com/emails/receiving/${emailId}`,
    {
      headers: { Authorization: `Bearer ${apiKey}` },
    },
  );

  if (!res.ok) {
    console.error(
      `[Email Webhook] Resend API error: ${res.status} ${res.statusText}`,
    );
    return null;
  }

  const data = await res.json();
  return {
    text: data.text || data.html || null,
    from: data.from || "",
    subject: data.subject || "",
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;

  const settings = await getOrgIntegrationSettings(orgId);
  if (!settings || !settings.emailEnabled) {
    return NextResponse.json({ error: "Integration not enabled" }, { status: 404 });
  }

  if (!verifyOrgWebhookSecret(request, settings.webhookSecret)) {
    return unauthorizedResponse();
  }

  const resendApiKey = settings.resendApiKey;

  try {
    const body = await request.json();

    let from: string;
    let subject: string;
    let textBody: string | null;

    if (body.type === "email.received" && body.data?.email_id) {
      from = body.data.from || "";
      subject = body.data.subject || "";

      if (!resendApiKey) {
        console.log(`[Email Webhook] No Resend API key for org ${orgId}`);
        return NextResponse.json({
          success: true,
          message: "No API key configured",
        });
      }

      const fullEmail = await fetchResendEmailBody(body.data.email_id, resendApiKey);
      if (!fullEmail?.text) {
        console.log(
          `[Email Webhook] Resend email ${body.data.email_id}: no body content`,
        );
        return NextResponse.json({
          success: true,
          message: "No email body to process",
        });
      }
      textBody = fullEmail.text;
    } else {
      from = body.from || body.From || "";
      subject = body.subject || body.Subject || "";
      textBody =
        body.text_body || body.TextBody || body.text || body.plain || null;
    }

    if (!textBody) {
      return NextResponse.json({ success: true, message: "No text body" });
    }

    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
    });

    const now = new Date();
    const timeContext = `Current date and time: ${now.toISOString()} (${now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}, ${now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}). Use this to understand relative dates like "today", "tomorrow", "next Monday", etc.`;
    const systemPrompt = `${org?.prompt || "You are a friendly and professional AI receptionist."}\n\n${timeContext}\n\nYou are processing an inbound email. Sender: ${from}. Subject: ${subject}. If the email contains a booking request, use the createBooking tool. If they ask about services, use listServices. Extract relevant information from the email.`;

    const chatId = `email-${Date.now()}`;
    const tools = createChatTools(chatId, orgId);

    const result = await generateText({
      model: "google/gemini-3-flash",
      system: systemPrompt,
      messages: [{ role: "user", content: textBody }],
      tools,
      stopWhen: stepCountIs(5),
    });

    console.log(`[Email Webhook] Org ${orgId} | Processed email from ${from}: ${subject}`);
    return NextResponse.json({
      success: true,
      response: result.text,
      from,
      subject,
    });
  } catch (error) {
    console.error("[Email Webhook] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
