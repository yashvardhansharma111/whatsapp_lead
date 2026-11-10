// Starts and ends a Super Admin's visit to someone else's account (lib/viewAs.ts).
//
// This has to live in Next.js. The decision — who may do it, to which account, as whom —
// is the backend's, and this calls it for exactly that. But what carries the decision is
// an httpOnly cookie on this app's own domain, which only a Next route handler can set,
// and `lib/auth.ts` reads it when building the session.
//
// Its absence is why "View as" did nothing: the backend validated and wrote the audit
// row, the browser was sent to /inbox, and the cookie that would have changed anything
// was never written — so the admin arrived in their own account and nothing looked wrong.
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { VIEW_AS_COOKIE, VIEW_AS_TTL_MS, encodeViewAs } from "@/lib/viewAs";

// The backend token lives on the session, not on `session.user` — reading it from the
// wrong one sent the backend an empty Bearer header, and "View as" answered Unauthorized
// for a Super Admin who was perfectly well signed in.

const BACKEND = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL ?? "";

interface StartResult {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  accountType: string;
  resellerType: string | null;
  parentTenantId: string | null;
  user: { id: string; name: string | null; email: string; role: string; permissions: string[] } | null;
  redirect: string;
}

async function callBackend(
  method: "POST" | "DELETE",
  token: string,
  body?: unknown,
): Promise<{ ok: boolean; status: number; json: Record<string, unknown> | null }> {
  const res = await fetch(`${BACKEND}/admin/view-as`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "1",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  return { ok: res.ok, status: res.status, json };
}

function fail(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  // Checked here only to avoid a pointless round trip; the backend decides, and its
  // refusal is what the person sees.
  if (!session?.user) return fail("Sign in first.", 401);
  if (!BACKEND) return fail("This is unavailable right now.", 503);

  const body = (await req.json().catch(() => null)) as
    | { tenantId?: string; userId?: string }
    | null;
  if (!body?.tenantId) return fail("Choose an account.", 400);

  const { ok, status, json } = await callBackend("POST", session.nestToken ?? "", {
    tenantId: body.tenantId,
    ...(body.userId ? { userId: body.userId } : {}),
  });
  if (!ok) {
    return fail(
      (json?.error as string) ?? (json?.message as string) ?? "Couldn't open this account.",
      status,
    );
  }

  const data = ((json?.data ?? json) as StartResult) ?? null;
  if (!data?.tenantId) return fail("Couldn't open this account.", 502);

  const cookieValue = encodeViewAs(
    {
      tenantId:       data.tenantId,
      tenantSlug:     data.tenantSlug,
      tenantName:     data.tenantName,
      accountType:    data.accountType,
      resellerType:   data.resellerType ?? null,
      parentTenantId: data.parentTenantId ?? null,
      user:           data.user ?? null,
    },
    session.user.id,
  );

  const res = NextResponse.json({ success: true, data: { redirect: data.redirect } });
  res.cookies.set(VIEW_AS_COOKIE, cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure:   process.env.NODE_ENV === "production",
    path:     "/",
    maxAge:   Math.floor(VIEW_AS_TTL_MS / 1000),
  });
  return res;
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user) return fail("Sign in first.", 401);

  // The cookie is cleared whatever the backend says. Failing to write an audit row is no
  // reason to strand someone inside another account.
  let redirect = "/tenants";
  if (BACKEND) {
    const { ok, json } = await callBackend("DELETE", session.nestToken ?? "");
    if (ok) redirect = ((json?.data ?? json) as { redirect?: string })?.redirect ?? redirect;
  }

  const res = NextResponse.json({ success: true, data: { redirect } });
  res.cookies.set(VIEW_AS_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure:   process.env.NODE_ENV === "production",
    path:     "/",
    maxAge:   0,
  });
  return res;
}
