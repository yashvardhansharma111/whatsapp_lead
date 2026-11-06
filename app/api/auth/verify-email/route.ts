// Re-sends the verification link. Called from the register and login screens when
// someone did not receive the first one.
import { NextRequest } from "next/server";
import { forwardAuth } from "@/lib/server/forwardAuth";

export const POST = (req: NextRequest) => forwardAuth(req, "verify-email", ["email"]);
