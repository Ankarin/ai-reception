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

type InboundEmail = {
  text: string | null;
  from: string;
  to: string;
  subject: string;
  messageId: string | null;
  inReplyTo: string | null;
  references: string | null;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asRecipientString(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === "string" ? entry : ""))
      .filter(Boolean)
      .join(", ");
  }
  return "";
}

function extractFirstEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const match = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0].toLowerCase() : null;
}

function normalizeReplySubject(subject: string): string {
  const clean = subject.trim();
  if (!clean) return "Re: Ваш запит до клініки";
  return /^re:/i.test(clean) ? clean : `Re: ${clean}`;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderReplyHtml(text: string): string {
  const escaped = escapeHtml(text);
  const withBold = escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  const withLineBreaks = withBold.replace(/\n/g, "<br />");

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.55; color: #111827; font-size: 15px;">
      ${withLineBreaks}
    </div>
  `.trim();
}

async function fetchResendEmailBody(
  emailId: string,
  apiKey: string,
): Promise<InboundEmail | null> {
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
    from: asString(data.from),
    to: asRecipientString(data.to),
    subject: asString(data.subject),
    messageId: asNullableString(data.message_id) || asNullableString(data.id),
    inReplyTo: asNullableString(data.in_reply_to),
    references: asNullableString(data.references),
  };
}

async function sendResendReply(params: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  inReplyTo?: string | null;
  references?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const headers: Record<string, string> = {};
  if (params.inReplyTo) {
    headers["In-Reply-To"] = params.inReplyTo;
  }
  if (params.references) {
    headers.References = params.references;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      from: params.from,
      to: [params.to],
      subject: normalizeReplySubject(params.subject),
      text: params.text,
      html: renderReplyHtml(params.text),
      ...(Object.keys(headers).length > 0 ? { headers } : {}),
    }),
  });

  if (response.ok) {
    return { ok: true };
  }

  const raw = await response.text().catch(() => "");
  return {
    ok: false,
    error: `Resend send failed: ${response.status} ${response.statusText}${raw ? ` | ${raw}` : ""}`,
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

    let inbound: InboundEmail;

    if (body.type === "email.received" && body.data?.email_id) {
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
      inbound = {
        text: fullEmail.text,
        from: fullEmail.from || asString(body.data.from),
        to: fullEmail.to || asRecipientString(body.data.to),
        subject: fullEmail.subject || asString(body.data.subject),
        messageId:
          fullEmail.messageId ||
          asNullableString(body.data.message_id) ||
          asNullableString(body.data.email_id),
        inReplyTo: fullEmail.inReplyTo || asNullableString(body.data.in_reply_to),
        references: fullEmail.references || asNullableString(body.data.references),
      };
    } else {
      inbound = {
        from: asString(body.from || body.From),
        to: asRecipientString(body.to || body.To || body.recipient || body.Recipient),
        subject: asString(body.subject || body.Subject),
        text:
          asNullableString(body.text_body || body.TextBody) ||
          asNullableString(body.text || body.plain),
        messageId:
          asNullableString(body.message_id || body.MessageID || body.messageId),
        inReplyTo:
          asNullableString(body.in_reply_to || body.InReplyTo || body.inReplyTo),
        references: asNullableString(body.references || body.References),
      };
    }

    if (!inbound.text) {
      return NextResponse.json({ success: true, message: "No text body" });
    }

    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
    });

    const now = new Date();
    const toolInstructions = `
IMPORTANT INSTRUCTIONS — you MUST follow these:
- Current date and time: ${now.toISOString()} (${now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}, ${now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}). Use this to understand relative dates like "today", "tomorrow", "next Monday", etc.
- You have tools available: listServices, checkAvailability, createBooking, lookupBooking, updateBooking. You MUST use them — never pretend to do something without calling the actual tool.

STRICT TOOL RULES:
1. SERVICES: NEVER guess or invent service names. ALWAYS call listServices first and only use names/IDs from the result.
2. DATES: NEVER guess dates. Convert relative dates ("tomorrow", "next Monday") using the current date above. Always use YYYY-MM-DD format. Always call checkAvailability before suggesting a time.
3. BOOKING: collect patient's full name, phone number, preferred date/time and service → call checkAvailability → call createBooking. Do NOT say a booking is made unless createBooking returned success.
4. LOOKUP: to find a booking, ask for the patient's NAME. Call lookupBooking with patientName. Phone is optional fallback only.
5. RESCHEDULE: call lookupBooking by name → call checkAvailability for the new date → call updateBooking with action "reschedule".
6. CANCEL: call lookupBooking by name → call updateBooking with action "cancel".
7. NEVER hallucinate or fabricate booking confirmations. NEVER say you "forwarded to admin" — use the tools directly.
8. If a tool returns an error or empty result, tell the patient honestly. Do not make up data.
- Write the final answer as an email reply: concise, clear, and polite.`;
    const systemPrompt = `${org?.prompt || "You are a friendly and professional AI receptionist."}\n${toolInstructions}\n\nEmail context:\n- Sender: ${inbound.from}\n- Subject: ${inbound.subject}`;

    const chatId = `email-${Date.now()}`;
    const tools = createChatTools(chatId, orgId, undefined, "email");

    const result = await generateText({
      model: "google/gemini-3-flash",
      system: systemPrompt,
      messages: [{ role: "user", content: inbound.text }],
      tools,
      stopWhen: stepCountIs(5),
    });

    const replyText =
      result.text?.trim() ||
      "Дякуємо за ваше звернення. Ми отримали лист і повернемося з деталями найближчим часом.";

    const senderEmail = extractFirstEmail(inbound.from);
    const configuredReplyFrom = extractFirstEmail(process.env.RESEND_FROM_EMAIL);
    const inboundRecipient = extractFirstEmail(inbound.to);
    const replyFromEmail = configuredReplyFrom || inboundRecipient || null;

    let replySent = false;
    let replyError: string | null = null;

    if (!resendApiKey) {
      replyError = "Resend API key is missing";
    } else if (!senderEmail) {
      replyError = `Unable to parse sender email from "${inbound.from}"`;
    } else if (!replyFromEmail) {
      replyError =
        "Unable to determine sender address for reply. Configure RESEND_FROM_EMAIL with a verified Resend sender address.";
    } else {
      const sendResult = await sendResendReply({
        apiKey: resendApiKey,
        from: replyFromEmail,
        to: senderEmail,
        subject: inbound.subject,
        text: replyText,
        inReplyTo: inbound.messageId || inbound.inReplyTo,
        references: inbound.references || inbound.messageId,
      });
      replySent = sendResult.ok;
      replyError = sendResult.error || null;
    }

    if (replyError) {
      console.error(`[Email Webhook] Reply error for org ${orgId}: ${replyError}`);
    }

    console.log(
      `[Email Webhook] Org ${orgId} | Processed email from ${inbound.from}: ${inbound.subject} | replySent=${replySent}`,
    );
    return NextResponse.json({
      success: true,
      response: replyText,
      from: inbound.from,
      subject: inbound.subject,
      replySent,
      replyError,
    });
  } catch (error) {
    console.error("[Email Webhook] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
