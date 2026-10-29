// Switches the active business. The backend validates ownership; this route owns
// the `current_business` cookie every proxied request (and the realtime ticket)
// reads — the catch-all proxy drops Set-Cookie, so it has to be set here.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { backendUrl, getNestToken } from "@/lib/server/nestToken";

const COOKIE = "current_business";
const ONE_YEAR = 60 * 60 * 24 * 365;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { businessId?: string };
  const businessId = typeof body.businessId === "string" ? body.businessId : "";
  if (!businessId) return NextResponse.json({ success: false, error: "businessId is required" }, { status: 400 });

  const current = req.cookies.get(COOKIE)?.value ?? null;
  const token = await getNestToken(session.user.id, session.user.email ?? "", current);
  if (!token) return NextResponse.json({ success: false, error: "Backend unreachable" }, { status: 502 });

  const upstream = await fetch(`${backendUrl()}/businesses/switch`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ businessId }),
    cache: "no-store",
  });
  const json = await upstream.json().catch(() => ({}));
  if (!upstream.ok || json?.success === false) {
    return NextResponse.json(
      { success: false, error: json?.error ?? json?.message ?? "Could not switch business" },
      { status: upstream.status || 400 },
    );
  }

  const res = NextResponse.json(json);
  res.cookies.set({
    name: COOKIE,
    value: businessId,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR,
  });
  return res;
}
