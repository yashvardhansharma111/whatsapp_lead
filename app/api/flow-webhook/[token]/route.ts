import { NextRequest, NextResponse } from "next/server";
import { backendUrl } from "@/lib/server/nestToken";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const MAX_BODY_BYTES = 64 * 1024;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!TOKEN_PATTERN.test(token)) {
    return NextResponse.json({ success: false, error: "Webhook not found" }, { status: 404 });
  }

  const body = await req.text();
  if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) {
    return NextResponse.json({ success: false, error: "Webhook payload is too large" }, { status: 413 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${backendUrl()}/webhook/flow/${token}`, {
      method: "POST",
      headers: { "Content-Type": req.headers.get("content-type") ?? "application/json" },
      body,
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ success: false, error: "Webhook service is unavailable" }, { status: 502 });
  }

  const responseBody = await upstream.arrayBuffer();
  return new NextResponse(responseBody, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
    },
  });
}
