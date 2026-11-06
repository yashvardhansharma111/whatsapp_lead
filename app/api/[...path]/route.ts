// Super-catch-all proxy: /api/<anything> → NestJS at BACKEND_INTERNAL_URL/<anything>
//
// More-specific route files take precedence in Next.js App Router, so:
//   /api/auth/[...nextauth]  → NextAuth (kept as-is, never reaches here)
//   /api/nest/[...path]      → existing NestJS proxy (never reaches here)
//   /api/workers/*           → QStash workers (kept as-is, never reaches here)
//   /api/cron/*              → Vercel cron jobs (kept as-is, never reaches here)
//
// Everything else hits this file and is forwarded to NestJS.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { backendUrl, getNestToken } from "@/lib/server/nestToken";

const BACKEND = backendUrl();

async function handler(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const businessId = req.cookies.get("current_business")?.value ?? null;

  const { path } = await params;
  const nestToken = await getNestToken(
    session.user.id ?? "",
    session.user.email ?? "",
    businessId,
  );

  const pathStr = path.join("/");
  const search  = req.nextUrl.search ?? "";
  const url     = `${BACKEND}/${pathStr}${search}`;

  const contentType = req.headers.get("Content-Type") ?? "";
  const isMultipart = contentType.includes("multipart/form-data");

  const headers: Record<string, string> = {
    // Harmless everywhere, and required when the backend is behind a free ngrok
    // tunnel, which otherwise answers with its interstitial page instead of JSON.
    "ngrok-skip-browser-warning": "1",
  };
  if (!isMultipart) headers["Content-Type"] = contentType || "application/json";
  if (nestToken) headers["Authorization"] = `Bearer ${nestToken}`;

  let body: BodyInit | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    if (isMultipart) {
      // Buffered whole and sent with an explicit length, for the same reason as the
      // /api/nest proxy: a chunked multipart body that ends a moment early fails in the
      // backend's parser as "Unexpected end of form", naming no hop.
      const buf = Buffer.from(await req.arrayBuffer());
      headers["Content-Type"] = contentType;
      headers["Content-Length"] = String(buf.length);
      body = buf;
    } else {
      body = await req.text();
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(url, { method: req.method, headers, body });
  } catch (err) {
    console.error(`[api-proxy] fetch error ${url}:`, err);
    return NextResponse.json({ success: false, error: "Backend unreachable" }, { status: 502 });
  }

  const responseContentType = upstream.headers.get("Content-Type") ?? "application/json";
  const upstreamBody = await upstream.arrayBuffer();

  if (!upstream.ok) {
    console.error(
      `[api-proxy] ${req.method} ${url} → ${upstream.status}`,
      new TextDecoder().decode(upstreamBody).slice(0, 400),
    );
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
