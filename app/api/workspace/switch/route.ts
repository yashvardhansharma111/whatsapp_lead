// Clears the active-business cookie when moving between workspaces.
//
// The NextAuth session itself is swapped by `update({ switchWorkspaceTenantId })`, which
// the jwt callback handles. This route exists only because `current_business` is httpOnly:
// a business id from the previous workspace is meaningless in the new one, and leaving it
// would have the service token quietly fall back to that workspace's first business.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const res = NextResponse.json({ success: true });
  res.cookies.set({
    name: "current_business",
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}
