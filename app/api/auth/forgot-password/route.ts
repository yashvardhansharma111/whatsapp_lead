// Sends a password-reset link. Always answers the same way whether or not the address
// exists — the backend decides that, and saying "no such account" would turn this form
// into a way of discovering who has one.
import { NextRequest } from "next/server";
import { forwardAuth } from "@/lib/server/forwardAuth";

export const POST = (req: NextRequest) => forwardAuth(req, "forgot-password", ["email"]);
