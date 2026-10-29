"use client";

// The workspaces this person belongs to: the one they own, plus any they were invited to
// as a team member. Switching re-issues the session for that workspace's membership —
// their role and permissions there, not here — without re-entering a password.

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Building2, Check, ChevronsUpDown, Loader2 } from "lucide-react";
import type { WorkspaceMembership } from "@/lib/auth";
import { cn } from "@/lib/utils";

const ROLE_LABEL: Record<string, string> = {
  TENANT_OWNER: "Owner",
  ADMIN: "Admin",
  MANAGER: "Manager",
  MARKETING_USER: "Marketing",
  AGENT: "Agent",
};

export function WorkspaceSwitcher({ className }: { className?: string }) {
  const { data: session, update } = useSession();
  const [open, setOpen] = useState(false);
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const workspaces: WorkspaceMembership[] = session?.user?.workspaces ?? [];
  const currentTenantId = session?.user?.tenantId;
  const current = workspaces.find((w) => w.tenantId === currentTenantId);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Nothing to switch between — don't take up space in the sidebar.
  if (workspaces.length < 2) return null;

  async function switchTo(ws: WorkspaceMembership) {
    if (ws.tenantId === currentTenantId || switchingTo) return;
    setSwitchingTo(ws.tenantId);
    setError(null);
    try {
      // Swap the session, then check it actually landed: a refused switch leaves the
      // old token in place, and navigating then would silently drop us back here.
      const next = await update({ switchWorkspaceTenantId: ws.tenantId });
      if (next?.user?.tenantId !== ws.tenantId) {
        setError(`You're no longer a member of ${ws.tenantName}.`);
        setSwitchingTo(null);
        return;
      }
      // Drop the old workspace's business cookie — a business id from another tenant
      // means nothing here.
      await fetch("/api/workspace/switch", { method: "POST" }).catch(() => {});
      // Full navigation, not a client transition: no cached query data may cross
      // workspaces — the same reasoning as switching business.
      window.location.assign("/inbox");
    } catch {
      setError("Couldn't switch workspace. Try again.");
      setSwitchingTo(null);
    }
  }

  return (
    <div className={cn("relative px-3", className)} ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition hover:bg-slate-100"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-900 text-[11px] font-semibold text-white">
          {(current?.tenantName ?? "W").slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold text-slate-900">
            {current?.tenantName ?? "Workspace"}
          </span>
          <span className="block truncate text-[10px] text-slate-500">
            {current ? (current.isOwner ? "Your workspace" : ROLE_LABEL[current.role] ?? current.role) : ""}
          </span>
        </span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute bottom-full left-3 right-3 z-30 mb-1 overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-slate-900/10"
        >
          <p className="border-b border-slate-100 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Your workspaces
          </p>
          <ul className="max-h-72 overflow-y-auto py-1">
            {workspaces.map((ws) => {
              const isCurrent = ws.tenantId === currentTenantId;
              const busy = switchingTo === ws.tenantId;
              return (
                <li key={ws.tenantId}>
                  <button
                    role="option"
                    aria-selected={isCurrent}
                    disabled={Boolean(switchingTo)}
                    onClick={() => switchTo(ws)}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-slate-50 disabled:opacity-60",
                      isCurrent && "bg-emerald-50/60",
                    )}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-slate-100 text-[10px] font-semibold text-slate-600">
                      {ws.tenantName.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-slate-900">{ws.tenantName}</span>
                      <span className="block truncate text-[10px] text-slate-500">
                        {ws.isOwner ? "Owner · your workspace" : `${ROLE_LABEL[ws.role] ?? ws.role} · invited`}
                      </span>
                    </span>
                    {busy ? (
                      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-emerald-600" />
                    ) : isCurrent ? (
                      <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="flex items-start gap-1.5 border-t border-slate-100 px-3 py-2 text-[10px] text-slate-500">
            <Building2 className="mt-0.5 h-3 w-3 shrink-0" />
            In a workspace you were invited to, you can do only what its owner allowed.
          </p>
          {error && <p className="px-3 pb-2 text-[10px] text-rose-700">{error}</p>}
        </div>
      )}
    </div>
  );
}
