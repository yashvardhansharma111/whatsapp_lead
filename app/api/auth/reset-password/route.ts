// Sets a new password from a reset link. The token is the authorisation, so there is no
// session here by design.
import { NextRequest } from "next/server";
import { forwardAuth } from "@/lib/server/forwardAuth";

export const POST = (req: NextRequest) => forwardAuth(req, "reset-password", ["token", "password"]);
