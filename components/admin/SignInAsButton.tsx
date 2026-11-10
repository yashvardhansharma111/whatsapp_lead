"use client";

// Opens an account as one of its people (lib/viewAs.ts).
//
// Separate from "View as", which opens the account with the admin's own powers. This one
// takes the person's role, permissions and name, so what appears is exactly what they
// see — the only way to settle a report of "this is missing" or "it won't let me".
//
// It is also the more dangerous of the two, because what the admin does is recorded as
// that person and the client cannot tell from the record that it was not them. So it
// names who it will become and says so plainly before it does anything.

import { useState } from "react";
import { Loader2, UserCheck, X } from "lucide-react";
import { AdminButton } from "@/components/admin/ui";

interface TenantUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
  lastLoginAt: string | null;
}

const ROLE_LABEL = (role: string) => role.toLowerCase().replace(/_/g, " ");

export function SignInAsButton({
  tenantId,
  tenantName,
  size = "sm",
  variant = "secondary",
}: {
  tenantId: string;
  tenantName: string;
  size?: "sm" | "md";
  variant?: "primary" | "secondary" | "ghost";
}) {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<TenantUser[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function openPicker() {
    setOpen(true);
    if (users) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/users`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Couldn't load the people in this account");
      setUsers(((json.data ?? json) as { users?: TenantUser[] }).users ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function signInAs(user: TenantUser) {
    setStarting(user.id);
    setError(null);
    try {
      const res = await fetch("/api/admin/view-as", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, userId: user.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Couldn't sign in as this person");
      // A full load, so the server renders the account with the new session.
      window.location.assign(json.data.redirect);
    } catch (e) {
      setError((e as Error).message);
      setStarting(null);
    }
  }

  return (
    <>
      <AdminButton size={size} variant={variant} onClick={openPicker}>
        <UserCheck className="h-3.5 w-3.5" />
        Sign in as
      </AdminButton>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Sign in as someone at ${tenantName}`}
        >
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
            <div className="mb-1 flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900">
                Sign in as someone at {tenantName}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="-mr-1 -mt-1 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-4 text-sm leading-relaxed text-slate-600">
              You will see exactly what they see, with their permissions. Anything you do is
              recorded as them, and they cannot tell from the record that it was not.
            </p>

            {error && (
              <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
            )}

            {loading ? (
              <p className="flex items-center gap-2 py-6 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </p>
            ) : users && users.length === 0 ? (
              <p className="py-6 text-sm text-slate-500">
                Nobody in this account can be signed in as.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {(users ?? []).map((u) => (
                  <li key={u.id} className="flex flex-wrap items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {u.name?.trim() || u.email}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {ROLE_LABEL(u.role)} · {u.email}
                      </p>
                    </div>
                    <AdminButton
                      size="sm"
                      disabled={starting !== null}
                      onClick={() => signInAs(u)}
                    >
                      {starting === u.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <UserCheck className="h-3.5 w-3.5" />
                      )}
                      Sign in
                    </AdminButton>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
