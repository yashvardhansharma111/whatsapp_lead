import type { DefaultSession } from "next-auth";
import type { PlanFeatures, WorkspaceMembership } from "@/lib/auth";

declare module "next-auth" {
  interface Session {
    /** NestJS JWT for direct server-component calls to the NestJS backend. */
    nestToken?: string;
    user: {
      id: string;
      role: string;
      tenantId: string;
      tenantSlug: string;
      tenantName: string;
      /** PLATFORM | RESELLER | CLIENT — see prisma AccountType. */
      accountType: string;
      /** NORMAL | WHITE_LABEL for resellers, else null. */
      resellerType: string | null;
      /** The reseller account this client belongs to, if any. */
      parentTenantId: string | null;
      avatar?: string;
      /** Display name of the tenant's current plan; null when none is known. */
      planName?: string | null;
      /** Plan feature switches from /auth/me; null until claims have loaded. */
      features?: PlanFeatures | null;
      /**
       * What this person may do in the workspace they are currently in. Resolved on the
       * server, which refuses the request regardless — this is only so the UI can avoid
       * offering an action that would be refused. Empty means "assume nothing".
       */
      permissions?: string[];
      /** Every workspace they belong to, for the switcher. */
      workspaces?: WorkspaceMembership[];
      /**
       * Set while a Super Admin is viewing another account (lib/viewAs.ts): the claims
       * above are that account's, and this is the admin's own. Null otherwise.
       */
      viewAs?: { homeTenantId: string; homeTenantName: string } | null;
    } & DefaultSession["user"];
  }

  interface User {
    role: string;
    tenantId: string;
    tenantSlug: string;
    tenantName: string;
    accountType: string;
    resellerType: string | null;
    parentTenantId: string | null;
    avatar?: string;
    nestToken?: string;
  }
}

// The JWT interface must be augmented on "@auth/core/jwt", not "next-auth/jwt". The latter is a
// bare `export * from "@auth/core/jwt"` re-export and declares nothing of its own, so augmenting it
// creates a second, unrelated interface that the callbacks never see. Because the real JWT extends
// Record<string, unknown>, the mismatch does not fail loudly — every `token.x` silently degrades to
// `unknown`, which is what forced the `as string` casts this file was supposed to make unnecessary.
declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: string;
    tenantId: string;
    tenantSlug: string;
    tenantName: string;
    accountType?: string;
    resellerType?: string | null;
    parentTenantId?: string | null;
    avatar?: string;
    planName?: string | null;
    features?: PlanFeatures | null;
    permissions?: string[];
    workspaces?: WorkspaceMembership[];
    /** When the claims above were last read from the database (ms). */
    claimsAt?: number;
    /** NestJS access_token stored for /auth/me claim refresh calls. */
    nestToken?: string;
  }
}
