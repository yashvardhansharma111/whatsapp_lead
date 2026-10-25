// SSE proxy: /api/events → NestJS /events
// Streams real-time tenant events (new-message, ping) to the browser.
// Uses the same service-token auth as all other proxied routes.

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

// Keep the connection open as long as possible (Vercel Pro = no limit; Hobby = 60s then auto-reconnect).
export const maxDuration = 300;

const BACKEND = process.env.BACKEND_INTERNAL_URL ?? "http://localhost:4000";

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function getNestToken(
  userId: string,
  email: string,
  businessId: string | null,
): Promise<string | null> {
  const cacheKey = `${userId}:${businessId ?? ""}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const secret = process.env.BACKEND_SERVICE_SECRET;
  if (!secret) return null;

  try {
    const res = await fetch(`${BACKEND}/auth/service-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, email, secret, businessId }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const { token, expiresIn } = json.data ?? json;
    tokenCache.set(cacheKey, { token, expiresAt: Date.now() + (expiresIn ?? 3600) * 1000 });
    return token;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const businessId = req.cookies.get("current_business")?.value ?? null;
  const nestToken = await getNestToken(
    (session.user as any).id ?? "",
    (session.user as any).email ?? "",
    businessId,
  );

  const headers: Record<string, string> = {
    Accept: "text/event-stream",
    "Cache-Control": "no-cache",
  };
  if (nestToken) headers["Authorization"] = `Bearer ${nestToken}`;

  let upstream: Response;
  try {
    upstream = await fetch(`${BACKEND}/events`, { headers });
  } catch {
    return new Response("Backend unreachable", { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    return new Response("Stream unavailable", { status: 502 });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      Connection: "keep-alive",
    },
  });
}
