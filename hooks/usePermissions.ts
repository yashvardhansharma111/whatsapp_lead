"use client";

import { useSession } from "next-auth/react";

/**
 * What the signed-in person may do in the workspace they are currently in.
 *
 * Fails closed: until the session carries permissions, `can` is false and the UI offers
 * nothing. The server refuses regardless — this only keeps us from showing an action that
 * would bounce. Mirrors the all-false default the contacts list already used.
 */
export function usePermissions() {
  const { data } = useSession();
  const granted = data?.user?.permissions;

  const can = (permission: string) => Array.isArray(granted) && granted.includes(permission);

  return {
    can,
    canAny: (...permissions: string[]) => permissions.some(can),
    /** Null while claims are still loading, so callers can tell "no" from "not yet". */
    loaded: Array.isArray(granted),
    permissions: granted ?? [],
  };
}

/** Single-permission shorthand. */
export function useCan(permission: string): boolean {
  return usePermissions().can(permission);
}
