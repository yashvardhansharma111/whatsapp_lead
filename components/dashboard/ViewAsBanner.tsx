"use client";

// Shown on every page while a Super Admin is inside another account (lib/viewAs.ts),
// so it's never mistaken for their own — with the way out.
//
// It says which of the two modes they are in, because they differ in a way that matters
// to whoever reads the records afterwards: as themselves, their name is on everything
// they do; signed in as someone, that person's name is, and the client has no way to see
// from the record that it was not them.

import { useState } from "react";
import { Eye, Loader2, LogOut, UserCheck } from "lucide-react";

export function ViewAsBanner({
  tenantName,
  reseller,
  actingAs,
}: {
  tenantName: string;
  reseller: boolean;
  /** The person they are signed in as, when they chose one. */
  actingAs?: { name: string; role: string } | null;
}) {
  const [leaving, setLeaving] = useState(false);

  async function exit() {
    setLeaving(true);
    try {
      const res = await fetch("/api/admin/view-as", { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      window.location.href = json?.data?.redirect ?? "/tenants";
    } catch {
      setLeaving(false);
    }
  }

  return (
    <div
      role="status"
      className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 bg-amber-400 py-2 pl-16 pr-4 text-sm text-amber-950 lg:px-6"
    >
      {actingAs
        ? <UserCheck className="hidden h-4 w-4 shrink-0 sm:block" />
        : <Eye className="hidden h-4 w-4 shrink-0 sm:block" />}
      <p className="min-w-0 flex-1">
        {actingAs ? (
          <>
            Signed in as <span className="font-semibold">{actingAs.name}</span>
            <span className="hidden sm:inline"> ({actingAs.role.toLowerCase().replace(/_/g, " ")}) at <span className="font-semibold">{tenantName}</span>. You are seeing only what they can see, and anything you do is recorded as them.</span>
            <span className="sm:hidden"> · {tenantName}</span>
          </>
        ) : (
          <>
            Viewing <span className="font-semibold">{tenantName}</span>
            <span className="hidden sm:inline"> as Super Admin — {reseller ? "reseller account" : "client account"}. Changes you make are real and are logged under your name.</span>
          </>
        )}
      </p>
      <button
        type="button"
        onClick={exit}
        disabled={leaving}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-amber-950 px-3 text-xs font-semibold text-amber-50 transition hover:bg-amber-900 disabled:opacity-60"
      >
        {leaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
        Exit to admin
      </button>
    </div>
  );
}
