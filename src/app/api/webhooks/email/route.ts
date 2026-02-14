import { type NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { db } from "@/db";
import { organizations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createChatTools } from "@/lib/chat/tool-factory";
import {
  verifyWebhookSecret,
  unauthorizedResponse,
} from "@/lib/utils/webhook-auth";

const DEMO_ORG_ID = process.env.DEMO_ORG_ID || "demo-dental-clinic";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";

/**
 * Fetch the full email content from Resend's API.
 * Resend webhooks only include metadata, not the body.
 */
async function fetchResendEmailBody(
  emailId: string,
): Promise<{ text: string | null; from: string; subject: string } | null> {
  if (!RESEND_API_KEY) return null;

  const res = await fetch(
    `https://api.resend.com/emails/receiving/${emailId}`,
    {
      headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
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

export async function POST(request: NextRequest) {
  if (!verifyWebhookSecret(request)) return unauthorizedResponse();

  try {
    const body = await request.json();

    let from: string;
    let subject: string;
    let textBody: string | null;

    // Detect Resend webhook format: { type: "email.received", data: { email_id, from, subject, ... } }
    if (body.type === "email.received" && body.data?.email_id) {
      from = body.data.from || "";
      subject = body.data.subject || "";

      // Resend webhooks don't include the body - fetch it via API
      const fullEmail = await fetchResendEmailBody(body.data.email_id);
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
      // Generic format (Postmark, SendGrid, etc.): { from, subject, text_body }
      from = body.from || body.From || "";
      subject = body.subject || body.Subject || "";
      textBody =
        body.text_body || body.TextBody || body.text || body.plain || null;
    }

    if (!textBody) {
      return NextResponse.json({ success: true, message: "No text body" });
    }

    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, DEMO_ORG_ID),
    });

    const systemPrompt = `${org?.prompt || "You are a friendly and professional AI receptionist for a dental clinic."}\n\nYou are processing an inbound email. Sender: ${from}. Subject: ${subject}. If the email contains a booking request, use the createBooking tool. If they ask about services, use listServices. Extract relevant information from the email.`;

    const chatId = `email-${Date.now()}`;
    const tools = createChatTools(chatId, DEMO_ORG_ID);

    const result = await generateText({
      model: "google/gemini-3-flash",
      system: systemPrompt,
      messages: [{ role: "user", content: textBody }],
      tools,
      maxSteps: 5,
    });

    console.log(`[Email Webhook] Processed email from ${from}: ${subject}`);
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
