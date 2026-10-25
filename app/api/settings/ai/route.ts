// Thin proxy: /api/settings/ai → NestJS /settings/ai
// All DB access is handled by NestJS; this route only forwards with auth.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";

const BACKEND = process.env.BACKEND_INTERNAL_URL ?? "http://localhost:4000";
const _cache  = new Map<string, { token: string; expiresAt: number }>();

async function nestToken(userId: string, email: string, businessId: string | null): Promise<string | null> {
  const k = `${userId}:${businessId ?? ""}`;
  const hit = _cache.get(k);
  if (hit && hit.expiresAt > Date.now() + 60_000) return hit.token;
  const secret = process.env.BACKEND_SERVICE_SECRET;
  if (!secret) return null;
  try {
    const res = await fetch(`${BACKEND}/auth/service-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, email, secret, businessId }),
    });
    if (!res.ok) return null;
    const j = await res.json();
    const { token, expiresIn } = j.data ?? j;
    _cache.set(k, { token, expiresAt: Date.now() + (expiresIn ?? 3600) * 1000 });
    return token;
  } catch { return null; }
}

async function handler(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cookieStore = await cookies();
  const businessId  = cookieStore.get("current_business")?.value ?? null;
  const token       = await nestToken((session.user as any).id ?? "", (session.user as any).email ?? "", businessId);

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let body: string | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") body = await req.text();

  let upstream: Response;
  try {
    upstream = await fetch(`${BACKEND}/settings/ai`, { method: req.method, headers, body });
  } catch {
    return NextResponse.json({ success: false, error: "Backend unreachable" }, { status: 502 });
  }

  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}

export const GET   = handler;
export const PATCH = handler;
