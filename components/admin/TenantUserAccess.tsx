"use client";

// Super admin → one person inside a customer's account: what they are, and what they may do.
//
// A workspace owner could already do this from their own Team page. From this side there
// was nothing — a customer who rang up asking for "give Priya campaigns but not billing"
// had to be talked through finding the screen themselves, and an account whose owner had
// left could not be handed to anyone at all.
//
// The account's own ceiling still applies on the server: nothing set here can give a
// customer's user any part of running the platform.

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Minus, ShieldCheck, X } from "lucide-react";
import { AdminButton, AdminSkeletonRows, adminInputClass } from "@/components/admin/ui";
import { PermissionTriState, type PermissionCell } from "@/components/admin/PermissionTriState";

const PERMISSION_LABEL: Record<string, string> = {
  "contacts.view": "View contacts",
  "contacts.manage": "Add and edit contacts",
  "contacts.delete": "Delete contacts",
  "contacts.import": "Import contacts",
  "contacts.export": "Export contacts",
  "conversations.view": "Open the inbox",
  "messages.send": "Send messages",
  "campaigns.view": "View campaigns",
  "campaigns.send": "Send campaigns",
  "templates.manage": "Manage templates",
  "blacklist.view": "View the blacklist",
  "blacklist.manage": "Manage the blacklist",
  "reports.view": "See reports",
  "users.manage": "Manage their team",
  "billing.manage": "Billing and wallet",
  "settings.manage": "Settings and integrations",
  "reseller.clients.view": "View their clients",
  "reseller.clients.manage": "Manage their clients",
  "reseller.plans.manage": "Manage their plans",
  "reseller.commissions.view": "See commissions",
  "whitelabel.manage": "White-label branding",
};

const PERMISSION_GROUPS: { label: string; perms: string[] }[] = [
  { label: "Contacts", perms: ["contacts.view", "contacts.manage", "contacts.delete", "contacts.import", "contacts.export"] },
  { label: "Inbox", perms: ["conversations.view", "messages.send"] },
  { label: "Campaigns", perms: ["campaigns.view", "campaigns.send", "templates.manage"] },
  { label: "Blacklist", perms: ["blacklist.view", "blacklist.manage"] },
  { label: "Reports", perms: ["reports.view"] },
  { label: "Account", perms: ["users.manage", "billing.manage", "settings.manage"] },
  { label: "Reseller", perms: ["reseller.clients.view", "reseller.clients.manage", "reseller.plans.manage", "reseller.commissions.view", "whitelabel.manage"] },
];

const ROLE_LABEL: Record<string, { name: string; detail: string }> = {
  TENANT_OWNER: { name: "Owner", detail: "Everything, always. An account has one owner — the current one becomes an Admin." },
  ADMIN: { name: "Admin", detail: "Everything except owning the account." },
  MANAGER: { name: "Manager", detail: "Contacts, inbox, campaigns and reports." },
  MARKETING_USER: { name: "Marketing", detail: "Contacts, inbox and campaigns." },
  AGENT: { name: "Agent", detail: "Contacts and the inbox." },
};

interface AccessResponse {
  user: { id: string; name: string | null; email: string; role: string };
  accountType: string;
  roles: string[];
  permissions: Record<string, PermissionCell>;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error ?? "That did not work");
  return (json.data ?? json) as T;
}

export function TenantUserAccess({
  tenantId,
  user,
  onClose,
}: {
  tenantId: string;
  user: { id: string; name: string | null; email: string; role: string };
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  const key = ["admin", "tenant", tenantId, "user", user.id, "access"];
  const base = `/api/admin/tenants/${tenantId}/users/${user.id}/access`;

  const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => api<AccessResponse>(base) });

  const save = useMutation({
    mutationFn: (body: { role?: string; permissions?: Record<string, boolean | null> }) =>
      api<{ ownershipTakenFrom: string | null }>(base, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      setError(null);
      setRole(null);
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ["admin", "tenant", tenantId] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const current = role ?? data?.user.role ?? user.role;
  const owner = (data?.user.role ?? user.role) === "TENANT_OWNER";
  const cells = data?.permissions ?? {};
  const roles = data?.roles ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Access for ${user.name?.trim() || user.email}`}
    >
      <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <ShieldCheck className="h-4 w-4 text-slate-400" />
              {user.name?.trim() || user.email}
            </h2>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        )}

        {isLoading ? (
          <AdminSkeletonRows rows={6} />
        ) : (
          <>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Role</span>
              <select
                id="tenant-user-role"
                className={adminInputClass}
                value={current}
                onChange={(e) => setRole(e.target.value)}
              >
                {roles.map((r) => (
                  <option key={r} value={r}>{ROLE_LABEL[r]?.name ?? r.replace(/_/g, " ")}</option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-slate-500">
                {ROLE_LABEL[current]?.detail ?? "What they can reach before anything below."}
              </span>
            </label>

            {current !== (data?.user.role ?? user.role) && (
              <div className="mt-2 flex justify-end">
                <AdminButton size="sm" disabled={save.isPending} onClick={() => save.mutate({ role: current })}>
                  {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Change role
                </AdminButton>
              </div>
            )}

            {owner ? (
              <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
                The owner has every permission in their account, and it cannot be taken away
                piece by piece. Give the account to someone else first if you need to limit them.
              </p>
            ) : (
              <>
                <div className="mt-4 space-y-4">
                  {PERMISSION_GROUPS.map((group) => {
                    const perms = group.perms.filter((p) => cells[p]);
                    if (!perms.length) return null;
                    return (
                      <section key={group.label}>
                        <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          {group.label}
                        </h3>
                        <ul className="divide-y divide-slate-100">
                          {perms.map((perm) => (
                            <li key={perm} className="flex items-center gap-3 py-2">
                              <span className="min-w-0 flex-1 text-sm text-slate-800">
                                {PERMISSION_LABEL[perm] ?? perm}
                              </span>
                              <PermissionTriState
                                value={cells[perm].override}
                                disabled={save.isPending}
                                onChange={(allowed) => save.mutate({ permissions: { [perm]: allowed } })}
                              />
                            </li>
                          ))}
                        </ul>
                      </section>
                    );
                  })}
                </div>
                <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
                  <Minus className="mr-1 inline h-3 w-3" /> follows their role&apos;s default.
                  A change takes effect on their next click — they do not have to sign in again.
                </p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
