import { NextRequest, NextResponse } from "next/server";

/**
 * Forwards a public auth action to the backend.
 *
 * These four — register, forgot-password, reset-password, verify-email — are the only
 * parts of the auth flow the backend owns. NextAuth owns the rest, which is why the
 * proxy keeps everything under `/api/auth` inside Next.js rather than rewriting it.
 *
 * The consequence, and the reason this exists: without a route file of its own, each of
 * these fell through to `[...nextauth]`, which saw an action it did not recognise and
 * answered 400 with a body carrying no `error`. Every one of these forms reported
 * "undefined" and none of them worked. A named route beats the catch-all, so each action
 * gets a file and they all share this.
 *
 * None of them carry a session — that is the point of all four.
 */
const BACKEND = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL ?? "";

export async function forwardAuth(
  req: NextRequest,
  action: string,
  required: string[] = [],
): Promise<NextResponse> {
  if (!BACKEND) {
    return NextResponse.json(
      { success: false, error: "This is unavailable right now. Please try again shortly." },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const missing = required.filter((k) => !String(body?.[k] ?? "").trim());
  if (missing.length) {
    return NextResponse.json(
      { success: false, error: `${missing.join(", ")} ${missing.length > 1 ? "are" : "is"} required.` },
      { status: 400 },
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${BACKEND}/auth/${action}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Harmless everywhere, and required when the backend sits behind a free ngrok
        // tunnel, which otherwise answers with its interstitial page instead of JSON.
        "ngrok-skip-browser-warning": "1",
        // Which front door this came through. Sign-up on a reseller's own domain is
        // that reseller's customer, and the backend cannot tell from the body alone.
        "X-Brand-Host": req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "",
      },
      body: JSON.stringify(body ?? {}),
      cache: "no-store",
    });
  } catch (err) {
    console.error(`[auth/${action}] backend unreachable:`, err);
    return NextResponse.json(
      { success: false, error: "We could not reach the server. Check your connection and try again." },
      { status: 502 },
    );
  }

  const json = await upstream.json().catch(() => null);

  if (!upstream.ok) {
    // The backend already explains itself — a duplicate email, a disposable domain, an
    // expired reset link. Passing its sentence through is better than replacing it with
    // a generic one the person cannot act on.
    return NextResponse.json(
      { success: false, error: json?.error ?? json?.message ?? "That did not work. Please try again." },
      { status: upstream.status },
    );
  }

  return NextResponse.json({ success: true, ...(json?.data ?? json) });
}
