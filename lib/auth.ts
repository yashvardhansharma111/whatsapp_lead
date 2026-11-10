import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { cookies } from "next/headers";
import { VIEW_AS_COOKIE, decodeViewAs } from "@/lib/viewAs";

const CLAIMS_TTL_MS = 5 * 60_000;

/** One workspace this person belongs to, for the switcher. */
export interface WorkspaceMembership {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  accountType: string;
  logo: string | null;
  role: string;
  isOwner: boolean;
  isCurrent: boolean;
}

export interface PlanFeatures {
  aiEnabled: boolean;
  ragEnabled: boolean;
  whiteLabel: boolean;
  advancedAi: boolean;
  allowExport: boolean;
  callingEnabled: boolean;
}

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
      planName:       (u.plan?.displayName as string | undefined) ?? null,
      features:       (u.plan?.features as PlanFeatures | undefined) ?? null,
      // What this person may do in the workspace they are currently in, and every
      // workspace they could switch to. Both are resolved server-side.
      permissions:    (u.permissions as string[] | undefined) ?? [],
      workspaces:     (u.workspaces as WorkspaceMembership[] | undefined) ?? [],
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
    async jwt({ token, user, trigger, session }) {
      // ── Switching workspace ──────────────────────────────────────────────
      // Driven from the client by `update({ switchWorkspaceTenantId })`. The backend
      // matches the membership on this person's email and mints a token for that
      // workspace's row, so no password is involved and nothing is kept in the browser.
      const switchTo = trigger === "update" ? (session as { switchWorkspaceTenantId?: string } | null)?.switchWorkspaceTenantId : undefined;
      if (switchTo && token.nestToken) {
        const base = backendUrl();
        try {
          const res = await fetch(`${base}/auth/switch-workspace`, {
            method:  "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token.nestToken}` },
            body:    JSON.stringify({ tenantId: switchTo }),
            cache:   "no-store",
          });
          if (res.ok) {
            const body = await res.json();
            const payload = body.data ?? body;
            const u = payload.user;
            token.nestToken      = payload.access_token;
            token.id             = u.id;
            token.role           = u.role;
            token.tenantId       = u.tenantId;
            token.tenantSlug     = u.tenantSlug;
            token.tenantName     = u.tenantName;
            token.accountType    = u.accountType;
            token.resellerType   = u.resellerType ?? null;
            token.parentTenantId = u.parentTenantId ?? null;
            token.avatar         = u.avatar ?? undefined;
            // Permissions are per-workspace, so they must come from the new one.
            const claims = await loadClaims(token.nestToken ?? "");
            if (claims) Object.assign(token, claims);
            token.claimsAt = Date.now();
          } else {
            console.warn(`[auth] switch-workspace refused: ${res.status}`);
          }
        } catch (err) {
          console.error("[auth] switch-workspace threw", err);
        }
        return token;
      }

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
        // The login response carries no plan; fetch it once so feature gates are right from the first page.
        const claims = await loadClaims(token.nestToken ?? "");
        if (claims) Object.assign(token, claims);
        return token;
      }

      if (!token.claimsAt || Date.now() - token.claimsAt > CLAIMS_TTL_MS) {
        console.log("[auth] jwt callback: refreshing claims via /auth/me");
        const claims = await loadClaims(token.nestToken ?? "");
        if (!claims) {
          // Backend unreachable — keep existing claims instead of killing the session.
          // Reset timer so we retry after CLAIMS_TTL_MS, not on every request.
          console.warn("[auth] jwt callback: loadClaims returned null — keeping existing token");
          token.claimsAt = Date.now();
          return token;
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
      session.user.planName       = token.planName ?? null;
      session.user.features       = token.features ?? null;
      session.user.permissions    = token.permissions ?? [];
      session.user.workspaces     = token.workspaces ?? [];
      session.user.viewAs         = null;

      if (token.role === "SUPER_ADMIN") {
        const target = decodeViewAs(await viewAsCookie(), token.id);
        // A different account, or the same one as a different person. The second half
        // matters because the platform account holds the Super Admin *and* the people who
        // work in it: signing in as one of them changes nothing about the tenant, so a
        // tenant-only test skipped the whole block and left them as themselves — sent
        // straight back to the admin panel by a role that had never been swapped.
        const switching = target && (target.tenantId !== token.tenantId || target.user);
        if (target && switching) {
          session.user.viewAs = {
            homeTenantId:   token.tenantId,
            homeTenantName: token.tenantName,
            adminId:        token.id,
            adminName:      token.name ?? null,
            user:           target.user,
          };
          session.user.tenantId       = target.tenantId;
          session.user.tenantSlug     = target.tenantSlug;
          session.user.tenantName     = target.tenantName;
          session.user.accountType    = target.accountType;
          session.user.resellerType   = target.resellerType;
          session.user.parentTenantId = target.parentTenantId;

          // Signed in as a person, not just into their account: take their identity and
          // their limits too. Keeping the admin's own role here would show every menu and
          // allow every action, which is the opposite of what someone checking a report
          // of "I can't see this" needs to find out.
          if (target.user) {
            session.user.id          = target.user.id;
            session.user.name        = target.user.name ?? target.user.email;
            session.user.email       = target.user.email;
            session.user.role        = target.user.role;
            session.user.permissions = target.user.permissions;
          }
        }
      }
      return session;
    },
  },
});
