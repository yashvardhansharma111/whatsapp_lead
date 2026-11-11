"use client";

// Super admin → the people who help run the platform, and how much of it each may touch.
//
// Running the platform used to mean being the Super Admin: every admin screen asked only
// "are you them", so there was nothing between all of it and none of it, and taking on
// help meant handing over everything — including other people's billing, their WhatsApp
// tokens and the power to create more admins.
//
// So staff are ordinary users on the platform account, and what they may do is decided
// here, one area at a time. A new admin starts able to look and change nothing.

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Minus, Plus, ShieldCheck, UserX, X } from "lucide-react";
import {
  AdminBadge,
  AdminButton,
  AdminPageHeader,
  AdminPanel,
  AdminSkeletonRows,
} from "@/components/admin/ui";
import { PermissionTriState, type PermissionCell } from "@/components/admin/PermissionTriState";

interface Staff {
  id: string;
  name: string | null;
  email: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  grantedCount: number;
}

/** What each permission lets someone do, in the words of the screen it governs. */
const PERMISSION_LABEL: Record<string, { title: string; detail: string }> = {
  "platform.tenants.view":       { title: "See customers",      detail: "Accounts, their plans, wallets and numbers" },
  "platform.tenants.manage":     { title: "Change customers",   detail: "Plan, wallet, suspension, password resets" },
  "platform.secrets.reveal":     { title: "Reveal tokens",      detail: "Read a customer's WhatsApp token in the clear" },
  "platform.plans.manage":       { title: "Manage plans",       detail: "The plans you sell" },
  "platform.pricing.manage":     { title: "Manage pricing",     detail: "Message rates, bulk changes, plan-end policy" },
  "platform.revenue.view":       { title: "See revenue",        detail: "Revenue, reports and commissions" },
  "platform.commissions.manage": { title: "Pay commissions",    detail: "Adjust or settle a reseller's commission" },
  "platform.categories.manage":  { title: "Manage categories",  detail: "The account categories" },
  "platform.cms.manage":         { title: "Edit the website",   detail: "The marketing site's copy" },
  "platform.whitelabel.manage":  { title: "Platform branding",  detail: "Your own brand and domains" },
  "platform.audit.view":         { title: "See audit logs",     detail: "What everyone has been doing" },
  "platform.staff.manage":       { title: "Manage admins",      detail: "Take on admins and decide what they may do" },
  "platform.impersonate":        { title: "Open accounts",      detail: "View as, and sign in as a customer's people" },
};

const ROLES = ["ADMIN", "MANAGER", "MARKETING_USER", "AGENT"] as const;
const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin", MANAGER: "Manager", MARKETING_USER: "Marketing", AGENT: "Agent",
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "That did not work");
  return (json.data ?? json) as T;
}

export default function AdminStaffPage() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "staff"],
    queryFn: () => api<{ staff: Staff[] }>("/api/admin/staff"),
  });

  const setActive = useMutation({
    mutationFn: (v: { id: string; isActive: boolean }) =>
      api(`/api/admin/staff/${v.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: v.isActive }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "staff"] }),
    onError: (e: Error) => setError(e.message),
  });

  const staff = data?.staff ?? [];

  return (
    <div>
      <AdminPageHeader
        title="Admins"
        description="People who help you run the platform, and how much of it each one may touch."
        action={
          <AdminButton onClick={() => { setError(null); setAdding(true); }}>
            <Plus className="h-4 w-4" />
            Add admin
          </AdminButton>
        }
      />

      {error && (
        <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      )}

      <AdminPanel title="Who can get in" bodyClassName="p-0">
        {isLoading ? (
          <AdminSkeletonRows rows={4} />
        ) : staff.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">
            Only you can reach the admin panel. Add someone to share parts of it.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {staff.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900">
                    {s.name?.trim() || s.email}
                    <AdminBadge tone={s.isActive ? "emerald" : "slate"}>
                      {s.isActive ? ROLE_LABEL[s.role] ?? s.role : "Deactivated"}
                    </AdminBadge>
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {s.email}
                    {" · "}
                    {s.grantedCount > 0
                      ? `${s.grantedCount} area${s.grantedCount === 1 ? "" : "s"} granted`
                      : "role defaults only"}
                  </p>
                </div>
                <AdminButton size="sm" variant="secondary" onClick={() => { setError(null); setEditing(s); }}>
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Access
                </AdminButton>
                <AdminButton
                  size="sm"
                  variant={s.isActive ? "ghost" : "secondary"}
                  disabled={setActive.isPending}
                  onClick={() => setActive.mutate({ id: s.id, isActive: !s.isActive })}
                >
                  <UserX className="h-3.5 w-3.5" />
                  {s.isActive ? "Deactivate" : "Reactivate"}
                </AdminButton>
              </li>
            ))}
          </ul>
        )}
      </AdminPanel>

      {adding && <AddStaff onClose={() => setAdding(false)} onError={setError} />}
      {editing && <StaffAccess staff={editing} onClose={() => setEditing(null)} onError={setError} />}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const inputClass =
  "h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none transition focus:border-slate-400";

function AddStaff({ onClose, onError }: { onClose: () => void; onError: (m: string) => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "ADMIN" });

  const create = useMutation({
    mutationFn: () =>
      api("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "staff"] });
      onClose();
    },
    onError: (e: Error) => onError(e.message),
  });

  const ready = form.name.trim() && form.email.trim() && form.password.length >= 8;

  return (
    <Modal title="Add an admin" onClose={onClose}>
      <div className="space-y-3">
        {(["name", "email", "password"] as const).map((field) => (
          <label key={field} className="block">
            <span className="mb-1 block text-sm font-medium capitalize text-slate-700">{field}</span>
            <input
              id={`staff-${field}`}
              className={inputClass}
              type={field === "password" ? "password" : field === "email" ? "email" : "text"}
              value={form[field]}
              onChange={(e) => setForm({ ...form, [field]: e.target.value })}
            />
          </label>
        ))}
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Role</span>
          <select
            id="staff-role"
            className={inputClass}
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABEL[r]}</option>
            ))}
          </select>
        </label>
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
          They will be able to see customers, revenue and the audit log, and change nothing.
          Hand over the rest from <span className="font-medium">Access</span> once they are in.
        </p>
        {form.password.length > 0 && form.password.length < 8 && (
          <p className="text-xs text-rose-600">Use at least 8 characters.</p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <AdminButton variant="secondary" onClick={onClose}>Cancel</AdminButton>
          <AdminButton disabled={!ready || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add
          </AdminButton>
        </div>
      </div>
    </Modal>
  );
}

function StaffAccess({
  staff,
  onClose,
  onError,
}: {
  staff: Staff;
  onClose: () => void;
  onError: (m: string) => void;
}) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "staff", staff.id, "permissions"],
    queryFn: () =>
      api<{ role: string; permissions: Record<string, PermissionCell> }>(
        `/api/admin/staff/${staff.id}/permissions`,
      ),
  });

  const set = useMutation({
    mutationFn: (v: { permission: string; allowed: boolean | null }) =>
      api(`/api/admin/staff/${staff.id}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: { [v.permission]: v.allowed } }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "staff", staff.id, "permissions"] });
      qc.invalidateQueries({ queryKey: ["admin", "staff"] });
    },
    onError: (e: Error) => onError(e.message),
  });

  const cells = data?.permissions ?? {};

  return (
    <Modal title={`What ${staff.name?.trim() || staff.email} may do`} onClose={onClose}>
      {isLoading ? (
        <AdminSkeletonRows rows={6} />
      ) : (
        <ul className="divide-y divide-slate-100">
          {Object.keys(PERMISSION_LABEL).map((perm) => {
            const cell = cells[perm];
            if (!cell) return null;
            const label = PERMISSION_LABEL[perm];
            return (
              <li key={perm} className="flex flex-wrap items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">{label.title}</p>
                  <p className="text-xs text-slate-500">{label.detail}</p>
                </div>
                <PermissionTriState
                  value={cell.override}
                  disabled={set.isPending}
                  onChange={(allowed) => set.mutate({ permission: perm, allowed })}
                />
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
        <Minus className="mr-1 inline h-3 w-3" /> follows their role&apos;s default.
        A change takes effect on their next click — they do not have to sign in again.
      </p>
    </Modal>
  );
}
