import { NextResponse } from "next/server";

// Temporary debug endpoint — remove after diagnosing auth issues
export async function GET() {
  const backendUrl =
    process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL ?? "";

  const envCheck = {
    AUTH_SECRET:            !!process.env.AUTH_SECRET,
    NEXTAUTH_SECRET:        !!process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL:           process.env.NEXTAUTH_URL ?? "(not set)",
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL ?? "(not set)",
    BACKEND_INTERNAL_URL:   process.env.BACKEND_INTERNAL_URL ?? "(not set)",
    BACKEND_SERVICE_SECRET: !!process.env.BACKEND_SERVICE_SECRET,
    backendUrlResolved:     backendUrl || "(empty — auth will fail)",
    NODE_ENV:               process.env.NODE_ENV,
  };

  let nestPing: Record<string, unknown> = { status: "not tested" };
  if (backendUrl) {
    try {
      const res = await fetch(`${backendUrl}/ping`, {
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      const body = await res.json().catch(() => null);
      nestPing = { httpStatus: res.status, body };
    } catch (err: any) {
      nestPing = { error: err?.message ?? String(err) };
    }
  }

  let nestAuth: Record<string, unknown> = { status: "not tested" };
  if (backendUrl) {
    try {
      // Try hitting /auth/login with fake creds to see if the route is reachable
      const res = await fetch(`${backendUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "probe@test.invalid", password: "probe123" }),
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      const body = await res.json().catch(() => null);
      nestAuth = { httpStatus: res.status, body };
    } catch (err: any) {
      nestAuth = { error: err?.message ?? String(err) };
    }
  }

  return NextResponse.json({ envCheck, nestPing, nestAuth }, { status: 200 });
}
