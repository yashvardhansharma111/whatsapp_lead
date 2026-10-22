import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { cookies } from "next/headers";
import { VIEW_AS_COOKIE, decodeViewAs } from "@/lib/viewAs";

const CLAIMS_TTL_MS = 5 * 60_000;

function backendUrl() {
  return process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL ?? "";
}

async function viewAsCookie(): Promise<string | undefined> {
  try {
    return (await cookies()).get(VIEW_AS_COOKIE)?.value;
  } catch {
    return undefined;
  }
}

/** Refresh claims by calling NestJS /auth/me with the stored NestJS JWT. */
async function loadClaims(nestToken: string) {
  const base = backendUrl();
  if (!base || !nestToken) return null;
  try {
    const res = await fetch(`${base}/auth/me`, {
      headers: { Authorization: `Bearer ${nestToken}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = await res.json();
    const u = body.data ?? body;
    return {
      role:           u.role           as string,
      tenantId:       u.tenantId       as string,
      tenantSlug:     u.tenantSlug     as string,
      tenantName:     u.tenantName     as string,
      accountType:    u.accountType    as string,
      resellerType:   (u.resellerType  as string | null) ?? null,
      parentTenantId: (u.parentTenantId as string | null) ?? null,
      avatar:         u.avatar         as string | undefined,
    };
  } catch {
    return null;
  }
}

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(6),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error:  "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email:    { label: "Email",    type: "email"    },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const base = backendUrl();
        if (!base) return null;

        let res: Response;
        try {
          res = await fetch(`${base}/auth/login`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ email: parsed.data.email, password: parsed.data.password }),
            cache:   "no-store",
          });
        } catch {
          return null;
        }

        if (!res.ok) return null;

        const body = await res.json();
        // TransformInterceptor wraps as { success, data } — unwrap if present
        const payload = body.data ?? body;
        const { access_token, user: u } = payload;

        if (!access_token || !u?.id) return null;

        return {
          id:             u.id,
          email:          u.email,
          name:           u.name          ?? null,
          role:           u.role,
          tenantId:       u.tenantId,
          tenantSlug:     u.tenantSlug,
          tenantName:     u.tenantName,
          accountType:    u.accountType,
          resellerType:   u.resellerType   ?? null,
          parentTenantId: u.parentTenantId ?? null,
          avatar:         u.avatar         ?? undefined,
          nestToken:      access_token,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id             = user.id ?? token.id;
        token.role           = user.role;
        token.tenantId       = user.tenantId;
        token.tenantSlug     = user.tenantSlug;
        token.tenantName     = user.tenantName;
        token.accountType    = user.accountType;
        token.resellerType   = user.resellerType;
        token.parentTenantId = user.parentTenantId;
        token.avatar         = user.avatar;
        token.nestToken      = (user as any).nestToken;
        token.claimsAt       = Date.now();
        return token;
      }

      // Refresh stale claims from NestJS every 5 min
      if (!token.claimsAt || Date.now() - token.claimsAt > CLAIMS_TTL_MS) {
        const claims = await loadClaims(token.nestToken ?? "");
        if (!claims) return null; // deactivated / token expired → sign out
        Object.assign(token, claims, { claimsAt: Date.now() });
      }
      return token;
    },

    async session({ session, token }) {
      session.user.id             = token.id;
      session.user.role           = token.role;
      session.user.tenantId       = token.tenantId;
      session.user.tenantSlug     = token.tenantSlug;
      session.user.tenantName     = token.tenantName;
      session.user.accountType    = token.accountType ?? "CLIENT";
      session.user.resellerType   = token.resellerType ?? null;
      session.user.parentTenantId = token.parentTenantId ?? null;
      session.user.avatar         = token.avatar;
      session.user.viewAs         = null;

      if (token.role === "SUPER_ADMIN") {
        const target = decodeViewAs(await viewAsCookie(), token.id);
        if (target && target.tenantId !== token.tenantId) {
          session.user.viewAs       = { homeTenantId: token.tenantId, homeTenantName: token.tenantName };
          session.user.tenantId     = target.tenantId;
          session.user.tenantSlug   = target.tenantSlug;
          session.user.tenantName   = target.tenantName;
          session.user.accountType  = target.accountType;
          session.user.resellerType = target.resellerType;
          session.user.parentTenantId = target.parentTenantId;
        }
      }
      return session;
    },
  },
});
