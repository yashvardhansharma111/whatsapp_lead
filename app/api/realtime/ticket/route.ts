// Mints a short-lived backend JWT for the browser's Socket.IO handshake.
// Same service-token flow as the catch-all proxy, scoped to the active business.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const BACKEND = process.env.BACKEND_INTERNAL_URL ?? "http://localhost:4000";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const secret = process.env.BACKEND_SERVICE_SECRET;
  if (!secret) return NextResponse.json({ error: "Realtime not configured" }, { status: 503 });

  const businessId = req.cookies.get("current_business")?.value ?? null;

  let token: string | undefined;
  try {
    const res = await fetch(`${BACKEND}/auth/service-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: session.user.id, email: session.user.email ?? "", secret, businessId }),
      cache: "no-store",
    });
    if (res.ok) {
      const json = await res.json();
      token = (json.data ?? json).token;
    }
  } catch {
    token = undefined;
  }
  if (!token) return NextResponse.json({ error: "Backend unreachable" }, { status: 502 });

  return NextResponse.json(
    { token, url: process.env.NEXT_PUBLIC_BACKEND_URL ?? "" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
