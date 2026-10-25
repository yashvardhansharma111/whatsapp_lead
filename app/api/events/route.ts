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
    console.warn("[events] SSE request rejected: no session");
    return new Response("Unauthorized", { status: 401 });
  }

  const userId     = (session.user as any).id   ?? "(unknown)";
  const tenantId   = (session.user as any).tenantId ?? "(unknown)";
  const businessId = req.cookies.get("current_business")?.value ?? null;
  console.log(`[events] SSE connect userId=${userId} tenantId=${tenantId} businessId=${businessId}`);

  const nestToken = await getNestToken(
    userId,
    (session.user as any).email ?? "",
    businessId,
  );

  if (!nestToken) {
    console.error("[events] Failed to obtain NestJS service token — BACKEND_SERVICE_SECRET missing or /auth/service-token failed");
  } else {
    console.log("[events] NestJS service token obtained OK");
  }

  const headers: Record<string, string> = {
    Accept: "text/event-stream",
    "Cache-Control": "no-cache",
  };
  if (nestToken) headers["Authorization"] = `Bearer ${nestToken}`;

  console.log(`[events] Connecting to upstream ${BACKEND}/events`);
  let upstream: Response;
  try {
    upstream = await fetch(`${BACKEND}/events`, { headers });
  } catch (err: any) {
    console.error(`[events] Upstream fetch threw: ${err?.message}`);
    return new Response("Backend unreachable", { status: 502 });
  }

  console.log(`[events] Upstream response status=${upstream.status} ok=${upstream.ok} hasBody=${!!upstream.body}`);
  if (!upstream.ok || !upstream.body) {
    console.error(`[events] Upstream not OK: status=${upstream.status}`);
    return new Response("Stream unavailable", { status: 502 });
  }

  console.log("[events] Streaming SSE to browser");
  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      Connection: "keep-alive",
    },
  });
}
