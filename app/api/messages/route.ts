// ============================================================================
// OWNER  : Gauransh
// MODULE : Messages
// ROUTE  : /api/messages
//
// METHODS
// POST   - Proxy to NestJS POST /messages, which handles the WhatsApp send,
//          DB write and conversation update.  Billing and Pusher remain here
//          so they run in the same runtime that owns the session.
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import type { Message } from "@prisma/client";
import { auth } from "@/lib/auth";
import { guardLimit } from "@/lib/billing/guard";
import { pusher, tenantChannel, PusherEvent } from "@/lib/pusher";
import { sendMessageSchema } from "@/lib/validators/message";

const BACKEND = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL ?? "";

// ── Service-token cache (same logic as /api/nest/[...path]) ──────────────────
const svcTokenCache = new Map<string, { token: string; expiresAt: number }>();

async function getServiceToken(
  userId: string,
  email: string,
  businessId: string | null,
): Promise<string | null> {
  const key = `${userId}:${businessId ?? ""}`;
  const hit = svcTokenCache.get(key);
  if (hit && hit.expiresAt > Date.now() + 60_000) return hit.token;

  const secret = process.env.BACKEND_SERVICE_SECRET ?? process.env.SERVICE_SECRET;
  if (!secret) {
    console.error("[MESSAGES] BACKEND_SERVICE_SECRET not set — cannot get service token");
    return null;
  }
  if (!BACKEND) {
    console.error("[MESSAGES] BACKEND_INTERNAL_URL / NEXT_PUBLIC_BACKEND_URL not set — cannot reach NestJS");
    return null;
  }

  const url = `${BACKEND}/auth/service-token`;
  console.log("[MESSAGES] getServiceToken → POST", url, { userId, email, businessId });
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, email, secret, businessId }),
    });
    const raw = await res.text();
    console.log("[MESSAGES] service-token response:", res.status, raw.slice(0, 300));
    if (!res.ok) return null;
    const json = JSON.parse(raw);
    const payload = json.data ?? json;
    svcTokenCache.set(key, { token: payload.token, expiresAt: Date.now() + (payload.expiresIn ?? 3600) * 1000 });
    return payload.token;
  } catch (err) {
    console.error("[MESSAGES] getServiceToken threw:", err);
    return null;
  }
}

// ── Pusher fan-out (fire-and-forget) ─────────────────────────────────────────
async function broadcastMessage(tenantId: string, message: Message): Promise<void> {
  if (!pusher) return;
  try {
    await pusher.trigger(tenantChannel(tenantId), PusherEvent.NEW_MESSAGE, message);
  } catch (err) {
    console.error("[MESSAGES] Pusher broadcast failed for message", message.id, err);
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // ── 1. Auth ─────────────────────────────────────────────────────────────────
  const session = await auth();
  if (!session?.user) {
    console.warn("[MESSAGES] POST — no session, returning 401");
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const user      = session.user as any;
  const tenantId  = user.tenantId  as string;
  const userId    = user.id        as string;
  const userEmail = user.email     as string;

  console.log("[MESSAGES] POST — userId:", userId, "tenantId:", tenantId, "backendUrl:", BACKEND || "(not set)");

  // ── 2. Parse + validate ──────────────────────────────────────────────────────
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch (err) {
    console.error("[MESSAGES] Body parse failed:", err);
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  console.log("[MESSAGES] raw body:", JSON.stringify({
    ...(rawBody as any),
    content: (rawBody as any)?.content?.slice(0, 80),
  }));

  const parsed = sendMessageSchema.safeParse(rawBody);
  if (!parsed.success) {
    console.error("[MESSAGES] Zod validation failed:", parsed.error.issues);
    return NextResponse.json({ success: false, error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { conversationId, isNote } = parsed.data;

  // ── 3. Billing (notes are free; only real sends count) ──────────────────────
  if (!isNote) {
    for (const window of ["messagesPerHour", "messagesPerDay"] as const) {
      const overLimit = await guardLimit(tenantId, window);
      if (overLimit) {
        console.log("[MESSAGES] Billing limit hit:", window);
        return overLimit;
      }
    }
  }

  // ── 4. Service token for NestJS ──────────────────────────────────────────────
  const businessId   = req.cookies.get("current_business")?.value ?? null;
  const serviceToken = await getServiceToken(userId, userEmail, businessId);

  if (!serviceToken) {
    console.error("[MESSAGES] Could not obtain NestJS service token — BACKEND_SERVICE_SECRET or backend URL missing");
    return NextResponse.json({ success: false, error: "Backend auth error — check BACKEND_SERVICE_SECRET on Vercel" }, { status: 500 });
  }

  // ── 5. Proxy to NestJS POST /messages ────────────────────────────────────────
  const nestUrl = `${BACKEND}/messages`;
  console.log("[MESSAGES] → NestJS POST", nestUrl, "conversationId:", conversationId, "type:", parsed.data.type);

  let nestRes: Response;
  try {
    nestRes = await fetch(nestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceToken}`,
      },
      body: JSON.stringify(parsed.data),
    });
  } catch (err) {
    console.error("[MESSAGES] NestJS fetch threw:", err);
    return NextResponse.json({ success: false, error: "Could not reach NestJS backend" }, { status: 502 });
  }

  const nestRaw = await nestRes.text();
  console.log("[MESSAGES] ← NestJS", nestRes.status, nestRaw.slice(0, 600));

  // ── 6. Handle NestJS error ───────────────────────────────────────────────────
  if (!nestRes.ok) {
    let nestErr: any = {};
    try { nestErr = JSON.parse(nestRaw); } catch {}
    // NestJS error shape: { statusCode, message, error }
    // Map to our shape: { success: false, error: <human message> }
    const errMsg: string = nestErr.message ?? nestErr.error ?? "Failed to send message";
    console.error("[MESSAGES] NestJS returned", nestRes.status, "message:", errMsg);
    return NextResponse.json({ success: false, error: errMsg }, { status: nestRes.status });
  }

  // ── 7. Parse NestJS success + Pusher broadcast ───────────────────────────────
  let nestJson: any = {};
  try { nestJson = JSON.parse(nestRaw); } catch {}
  // TransformInterceptor wraps: { success: true, data: Message }
  const message: Message = nestJson.data ?? nestJson;

  console.log("[MESSAGES] success — messageId:", (message as any)?.id, "waMessageId:", (message as any)?.waMessageId);

  // Broadcast to inbox watchers (fire-and-forget)
  void broadcastMessage(tenantId, message);

  return NextResponse.json({ success: true, data: message }, { status: 201 });
}
