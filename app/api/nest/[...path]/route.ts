// Transparent proxy: /api/nest/<path> → NestJS at BACKEND_INTERNAL_URL/<path>
// Auth: reads NextAuth session → exchanges for NestJS JWT via /auth/service-token

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const BACKEND = process.env.BACKEND_INTERNAL_URL ?? "http://localhost:4000";

// In-process JWT cache: "userId:businessId" → { token, expiresAt }
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
    // NestJS TransformInterceptor wraps as { success, data: { token, expiresIn } }
    const payload = json.data ?? json;
    const { token, expiresIn } = payload;
    tokenCache.set(cacheKey, {
      token,
      expiresAt: Date.now() + (expiresIn ?? 3600) * 1000,
    });
    return token;
  } catch {
    return null;
  }
}

async function handler(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Read active business from the same cookie Next.js uses in getBusinessScope()
  const businessId = req.cookies.get("current_business")?.value ?? null;

  const { path } = await params;
  const nestToken = await getNestToken(
    (session.user as any).id ?? "",
    (session.user as any).email ?? "",
    businessId,
  );

  const pathStr = path.join("/");
  const search  = req.nextUrl.search ?? "";
  const url     = `${BACKEND}/${pathStr}${search}`;

  const contentType = req.headers.get("Content-Type") ?? "";
  const isMultipart = contentType.includes("multipart/form-data");

  const headers: Record<string, string> = {};
  if (!isMultipart) headers["Content-Type"] = contentType || "application/json";
  if (nestToken) headers["Authorization"] = `Bearer ${nestToken}`;

  let body: BodyInit | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = isMultipart ? await req.blob() : await req.text();
  }

  let upstream: Response;
  try {
    upstream = await fetch(url, { method: req.method, headers, body });
  } catch (err) {
    console.error(`[nest-proxy] fetch error ${url}:`, err);
    return NextResponse.json({ success: false, error: "Backend unreachable" }, { status: 502 });
  }

  // Preserve Content-Type so CSV/JSON downloads work correctly
  const responseContentType = upstream.headers.get("Content-Type") ?? "application/json";
  const upstreamBody = await upstream.arrayBuffer();

  if (!upstream.ok) {
    console.error(`[nest-proxy] ${req.method} ${url} → ${upstream.status}`,
      new TextDecoder().decode(upstreamBody).slice(0, 400));
  }

  return new NextResponse(upstreamBody, {
    status:  upstream.status,
    headers: {
      "Content-Type": responseContentType,
      ...(upstream.headers.get("Content-Disposition")
        ? { "Content-Disposition": upstream.headers.get("Content-Disposition")! }
        : {}),
    },
  });
}

export const GET    = handler;
export const POST   = handler;
export const PATCH  = handler;
export const PUT    = handler;
export const DELETE = handler;
