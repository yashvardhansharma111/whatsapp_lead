// ============================================================================
// ROUTE  : /api/integrations/whatsapp/test
// POST   - Proxy to NestJS POST /integrations/whatsapp/:id/test
//          Verifies stored token against Meta, refreshes DB snapshot.
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const BACKEND = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL ?? "";

const svcTokenCache = new Map<string, { token: string; expiresAt: number }>();

async function getServiceToken(userId: string, email: string, businessId: string | null): Promise<string | null> {
  const key = `${userId}:${businessId ?? ""}`;
  const hit = svcTokenCache.get(key);
  if (hit && hit.expiresAt > Date.now() + 60_000) return hit.token;

  const secret = process.env.BACKEND_SERVICE_SECRET ?? process.env.SERVICE_SECRET;
  if (!secret || !BACKEND) return null;

  try {
    const res = await fetch(`${BACKEND}/auth/service-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, email, secret, businessId }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const payload = json.data ?? json;
    svcTokenCache.set(key, { token: payload.token, expiresAt: Date.now() + (payload.expiresIn ?? 3600) * 1000 });
    return payload.token;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  console.log("[WA TEST] POST called — backendUrl:", BACKEND || "(not set)");

  const session = await auth();
  if (!session?.user) {
    console.warn("[WA TEST] no session → 401");
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const user       = session.user as any;
  const userId     = user.id    as string;
  const userEmail  = user.email as string;
  console.log("[WA TEST] userId:", userId, "email:", userEmail);

  let body: any = {};
  try {
    const raw = await req.text();
    if (raw) body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { integrationId, businessId: bodyBusinessId } = body;
  const businessId = bodyBusinessId ?? req.cookies.get("current_business")?.value ?? null;
  console.log("[WA TEST] integrationId:", integrationId, "businessId:", businessId);

  if (!integrationId) {
    console.error("[WA TEST] missing integrationId in body");
    return NextResponse.json({ success: false, error: "integrationId is required" }, { status: 400 });
  }

  const serviceToken = await getServiceToken(userId, userEmail, businessId);
  console.log("[WA TEST] serviceToken obtained:", !!serviceToken);

  if (!serviceToken) {
    console.error("[WA TEST] no service token — check BACKEND_SERVICE_SECRET on Vercel");
    return NextResponse.json(
      { success: false, error: "Backend auth error — check BACKEND_SERVICE_SECRET on Vercel" },
      { status: 500 },
    );
  }

  const nestUrl = `${BACKEND}/integrations/whatsapp/${integrationId}/test`;
  console.log("[WA TEST] → NestJS POST", nestUrl);

  let nestRes: Response;
  try {
    nestRes = await fetch(nestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceToken}`,
      },
    });
  } catch (err) {
    console.error("[WA TEST] NestJS fetch threw:", err);
    return NextResponse.json({ success: false, error: "Could not reach backend" }, { status: 502 });
  }

  const nestRaw = await nestRes.text();
  console.log("[WA TEST] ← NestJS", nestRes.status, nestRaw.slice(0, 400));

  if (!nestRes.ok) {
    let nestErr: any = {};
    try { nestErr = JSON.parse(nestRaw); } catch {}
    const errMsg = nestErr.message ?? nestErr.error ?? "Test failed";
    console.error("[WA TEST] NestJS returned", nestRes.status, "—", errMsg);
    return NextResponse.json({ success: false, error: errMsg }, { status: nestRes.status });
  }

  let nestJson: any = {};
  try { nestJson = JSON.parse(nestRaw); } catch {}
  // TransformInterceptor wraps: { success: true, data: result }
  const result = nestJson.data ?? nestJson;

  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error ?? "Test failed" },
      { status: 400 },
    );
  }

  // Shape matches WhatsAppTestDTO expected by the frontend
  return NextResponse.json({
    success: true,
    data: {
      integrationId:          result.integrationId          ?? integrationId,
      phoneNumberId:          result.phoneNumberId          ?? null,
      wabaId:                 result.wabaId                 ?? null,
      displayPhoneNumber:     result.displayPhoneNumber     ?? null,
      verifiedName:           result.verifiedName           ?? null,
      qualityRating:          result.qualityRating          ?? null,
      codeVerificationStatus: result.codeVerificationStatus ?? null,
    },
  });
}
