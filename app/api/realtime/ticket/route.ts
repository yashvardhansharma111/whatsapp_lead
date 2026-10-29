// Mints a short-lived backend JWT for the browser's Socket.IO handshake, scoped
// to the active business (same service-token flow as the proxies).

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getNestToken } from "@/lib/server/nestToken";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const businessId = req.cookies.get("current_business")?.value ?? null;
  const token = await getNestToken(session.user.id, session.user.email ?? "", businessId);
  if (!token) return NextResponse.json({ error: "Realtime unavailable" }, { status: 503 });

  return NextResponse.json(
    { token, url: process.env.NEXT_PUBLIC_BACKEND_URL ?? "" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
