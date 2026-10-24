/**
 * POST /api/v1/messages
 *
 * Send a WhatsApp message from your connected number.
 *
 * Auth: Authorization: Bearer <api_key>
 *
 * Body (text):
 *   { "to": "+919876543210", "type": "text", "text": "Hello!" }
 *
 * Body (template):
 *   { "to": "+919876543210", "type": "template", "template": "my_template", "language": "en_US",
 *     "components": [...] }
 */
import { NextRequest, NextResponse } from "next/server";
import { authenticateV1, unauthorized } from "@/lib/v1auth";
import { resolveWhatsAppCreds } from "@/lib/business";
import { sendTextMessage, sendTemplateMessage } from "@/lib/whatsapp";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const TextSchema = z.object({
  to: z.string().min(7, "Phone number too short"),
  type: z.literal("text"),
  text: z.string().min(1, "Message text is required"),
});

const TemplateSchema = z.object({
  to: z.string().min(7, "Phone number too short"),
  type: z.literal("template"),
  template: z.string().min(1, "Template name is required"),
  language: z.string().default("en_US"),
  components: z.array(z.record(z.string(), z.unknown())).optional(),
});

const SendSchema = z.discriminatedUnion("type", [TextSchema, TemplateSchema]);

export async function POST(req: NextRequest) {
  const scope = await authenticateV1(req);
  if (!scope) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = SendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 422 },
    );
  }

  const creds = await resolveWhatsAppCreds(scope.businessId);
  if (!creds.phoneNumberId || !creds.apiKey) {
    return NextResponse.json(
      { success: false, error: "WhatsApp is not connected for this business." },
      { status: 503 },
    );
  }

  const data = parsed.data;
  const phone = data.to.replace(/\D/g, "");

  try {
    let result;
    if (data.type === "text") {
      result = await sendTextMessage(creds.phoneNumberId, creds.apiKey, phone, data.text);
    } else {
      result = await sendTemplateMessage(
        creds.phoneNumberId,
        creds.apiKey,
        phone,
        data.template,
        data.language,
        data.components as never[],
      );
    }

    const waMessageId = result.messages?.[0]?.id ?? null;

    // Persist sent message to inbox (best-effort — never fail the API response)
    persistMessage({
      tenantId: scope.tenantId,
      businessId: scope.businessId,
      phone,
      waMessageId,
      type: data.type === "text" ? "TEXT" : "TEMPLATE",
      preview: data.type === "text" ? data.text : data.template,
    }).catch(() => {});

    return NextResponse.json({ success: true, messageId: waMessageId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send message";
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}

async function persistMessage(opts: {
  tenantId: string;
  businessId: string;
  phone: string;
  waMessageId: string | null;
  type: "TEXT" | "TEMPLATE";
  preview: string;
}) {
  const { tenantId, businessId, phone, waMessageId, type, preview } = opts;

  const contact = await prisma.contact.upsert({
    where: { phone_businessId: { phone, businessId } },
    create: { tenantId, businessId, phone, waId: phone, name: "" },
    update: {},
  });

  let conversation = await prisma.conversation.findFirst({
    where: { tenantId, businessId, contactId: contact.id },
    orderBy: { createdAt: "desc" },
  });
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: { tenantId, businessId, contactId: contact.id, status: "OPEN" },
    });
  }

  await prisma.$transaction([
    prisma.message.create({
      data: {
        tenantId,
        businessId,
        conversationId: conversation.id,
        direction: "OUTBOUND",
        type,
        content: preview,
        status: "SENT",
        waMessageId,
        isAiGenerated: false,
      },
    }),
    prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date(), lastMessagePreview: preview.slice(0, 100) },
    }),
  ]);
}
