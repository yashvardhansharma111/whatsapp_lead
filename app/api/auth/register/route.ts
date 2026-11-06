// Sign-up. The backend owns the whole transaction: the tenant, the owner account, the
// starter subscription and the trial.
//
// This file has to exist. `/api/auth` is kept inside Next.js by the proxy so NextAuth's
// own routes are never forwarded, and without a handler of its own `/api/auth/register`
// fell through to `[...nextauth]`, which saw an action it did not recognise and answered
// 400 with a body carrying no `error` — so the form reported "undefined" and sign-up was
// impossible. A named route beats the catch-all, which is the whole fix.
import { NextRequest } from "next/server";
import { forwardAuth } from "@/lib/server/forwardAuth";

export const POST = (req: NextRequest) =>
  forwardAuth(req, "register", ["name", "email", "password", "workspaceName"]);
