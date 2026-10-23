import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { cookies } from "next/headers";
import { VIEW_AS_COOKIE, decodeViewAs } from "@/lib/viewAs";

const CLAIMS_TTL_MS = 5 * 60_000;

function backendUrl() {
  const url = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL ?? "";
  console.log("[auth] backendUrl resolved:", url || "(empty — not set)");
  return url;
}

async function viewAsCookie(): Promise<string | undefined> {
  try {
    return (await cookies()).get(VIEW_AS_COOKIE)?.value;
  } catch {
    return undefined;
  }
}

async function loadClaims(nestToken: string) {
  const base = backendUrl();
  if (!base || !nestToken) {
    console.log("[auth] loadClaims: skipped — no backendUrl or no nestToken");
    return null;
  }
  try {
    console.log("[auth] loadClaims: calling /auth/me");
    const res = await fetch(`${base}/auth/me`, {
      headers: { Authorization: `Bearer ${nestToken}` },
      cache: "no-store",
    });
    console.log("[auth] loadClaims: /auth/me status", res.status);
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
  } catch (err) {
    console.error("[auth] loadClaims: fetch threw", err);
    return null;
  }
}

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(6),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error:  "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email:      { label: "Email",     type: "email"    },
        password:   { label: "Password",  type: "password" },
        tenantSlug: { label: "Workspace", type: "text"     },
      },
      async authorize(credentials) {
        console.log("[auth] authorize: called with email:", (credentials as any)?.email);

        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          console.log("[auth] authorize: schema validation failed", parsed.error.issues);
          return null;
        }

        const base = backendUrl();
        if (!base) {
          console.error("[auth] authorize: BACKEND_INTERNAL_URL and NEXT_PUBLIC_BACKEND_URL are both unset");
          return null;
        }

        const loginUrl = `${base}/auth/login`;
        console.log("[auth] authorize: POSTing to", loginUrl);

        let res: Response;
        try {
          const tenantSlug = (credentials as any)?.tenantSlug;
          res = await fetch(loginUrl, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({
              email:      parsed.data.email,
              password:   parsed.data.password,
              ...(tenantSlug ? { tenantSlug } : {}),
            }),
            cache:   "no-store",
          });
        } catch (err) {
          console.error("[auth] authorize: fetch to NestJS threw:", err);
          return null;
        }

        console.log("[auth] authorize: NestJS /auth/login status:", res.status);

        if (!res.ok) {
          let errBody = "";
          try { errBody = await res.text(); } catch {}
          console.error("[auth] authorize: NestJS returned non-OK. Body:", errBody);
          return null;
        }

        let body: any;
        try {
          body = await res.json();
        } catch (err) {
          console.error("[auth] authorize: failed to parse NestJS response JSON:", err);
          return null;
        }

        console.log("[auth] authorize: NestJS response keys:", Object.keys(body));

        // TransformInterceptor wraps as { success, data } — unwrap if present
        const payload = body.data ?? body;
        const { access_token, user: u } = payload;

        console.log("[auth] authorize: access_token present:", !!access_token, "user.id:", u?.id);

        if (!access_token || !u?.id) {
          console.error("[auth] authorize: missing access_token or user.id in NestJS response");
          return null;
        }

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
        console.log("[auth] jwt callback: initial sign-in for user", user.id);
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

      if (!token.claimsAt || Date.now() - token.claimsAt > CLAIMS_TTL_MS) {
        console.log("[auth] jwt callback: refreshing claims via /auth/me");
        const claims = await loadClaims(token.nestToken ?? "");
        if (!claims) {
          console.warn("[auth] jwt callback: loadClaims returned null — signing out");
          return null;
        }
        Object.assign(token, claims, { claimsAt: Date.now() });
      }
      return token;
    },

    async session({ session, token }) {
      // nestToken is kept server-side for NestJS direct calls in server components.
      (session as any).nestToken = token.nestToken;

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
          session.user.viewAs         = { homeTenantId: token.tenantId, homeTenantName: token.tenantName };
          session.user.tenantId       = target.tenantId;
          session.user.tenantSlug     = target.tenantSlug;
          session.user.tenantName     = target.tenantName;
          session.user.accountType    = target.accountType;
          session.user.resellerType   = target.resellerType;
          session.user.parentTenantId = target.parentTenantId;
        }
      }
      return session;
    },
  },
});
