"use client";

// Super admin → message prices: what each WhatsApp template message costs.
// Two scopes live here: the platform default every account falls back to, and the
// per-customer prices that override it. Resellers set their own prices for their
// clients (never below the platform price) from their own screens.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Info, Search, Tag } from "lucide-react";
import {
  AdminBadge, AdminButton, AdminPageHeader, AdminPanel, AdminSkeletonRows, adminInputClass,
} from "@/components/admin/ui";
import { RATE_LONG_LABEL, SOURCE_LABEL, paise, type ResolvedRate } from "@/lib/billing/rates";
import { cn, formatDate } from "@/lib/utils";

interface PlatformRate {
  category: string;
  priceMinor: number | null;
}

interface CustomerOverride {
  tenant: { id: string; name: string; slug: string; accountType: string; parentId: string | null };
  updatedAt: string;
  rates: ResolvedRate[];
}

export default function AdminRatesPage() {
  const qc = useQueryClient();
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [savingCategory, setSavingCategory] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "rates"],
    queryFn: async () => {
      const res = await fetch("/api/admin/rates");
      if (!res.ok) throw new Error("Failed to load prices");
      const json = await res.json();
      return {
        platform: (json.data ?? []) as PlatformRate[],
        customers: (json.customers ?? []) as CustomerOverride[],
      };
    },
  });

  const save = useMutation({
    mutationFn: async (v: { category: string; priceMinor: number | null }) => {
      setSavingCategory(v.category);
      setRowErrors((e) => { const n = { ...e }; delete n[v.category]; return n; });
      const res = await fetch("/api/admin/rates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Save failed");
      return v.category;
    },
    onSettled: () => setSavingCategory(null),
    onSuccess: (_d, v) => {
      setEdits((e) => { const n = { ...e }; delete n[v.category]; return n; });
      void qc.invalidateQueries({ queryKey: ["admin", "rates"] });
    },
    onError: (err, v) => {
      setRowErrors((e) => ({ ...e, [v.category]: (err as Error).message }));
    },
  });

  const customers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = data?.customers ?? [];
    if (!q) return list;
    return list.filter((c) => c.tenant.name.toLowerCase().includes(q) || c.tenant.slug.toLowerCase().includes(q));
  }, [data?.customers, search]);

  return (
    <>
      <AdminPageHeader title="Message prices" description="What each message costs clients' wallets, in paise per unit (₹0.20 = 20 paise)." />

      <AdminPanel title="Platform prices" subtitle="The default every account falls back to">
        {isLoading || !data ? (
          <AdminSkeletonRows rows={3} />
        ) : (
          <div className="space-y-3">
            {data.platform.map((r) => {
              const value = edits[r.category] ?? (r.priceMinor === null ? "" : String(r.priceMinor));
              const dirty = r.category in edits;
              const saving = savingCategory === r.category;
              return (
                <div key={r.category} className="flex flex-col gap-1.5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <span className="text-sm text-slate-700 sm:w-72">{RATE_LONG_LABEL[r.category] ?? r.category}</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        value={value}
                        placeholder="Not set — free"
                        onChange={(e) => setEdits((x) => ({ ...x, [r.category]: e.target.value }))}
                        className={cn(adminInputClass, "h-10 w-36 sm:h-9 sm:w-44")}
                        aria-label={`Price for ${RATE_LONG_LABEL[r.category]}`}
                      />
                      <span className="text-xs text-slate-500">paise{value && ` = ₹${(Number(value) / 100).toFixed(2)}`}</span>
                      {dirty && (
                        <AdminButton
                          size="sm"
                          disabled={saving}
                          onClick={() => save.mutate({ category: r.category, priceMinor: value === "" ? null : Math.round(Number(value)) })}
                        >
                          {saving ? "Saving…" : "Save"}
                        </AdminButton>
                      )}
                    </div>
                  </div>
                  {rowErrors[r.category] && (
                    <p className="pl-0 sm:pl-72 text-xs text-rose-700">{rowErrors[r.category]}</p>
                  )}
                </div>
              );
            })}
            <p className="flex items-start gap-1.5 pt-2 text-xs text-slate-500">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Charged per WhatsApp template message sent by a campaign or broadcast; inbox replies are never charged.
              Changing a platform price moves every account that has not been given its own.
            </p>
          </div>
        )}
      </AdminPanel>

      <div className="mt-6">
        <AdminPanel
          title="Per-customer prices"
          subtitle="Accounts given their own price. Set one from the account's page."
        >
          {isLoading || !data ? (
            <AdminSkeletonRows rows={3} />
          ) : (data.customers.length === 0) ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 ring-1 ring-inset ring-slate-900/5">
                <Tag className="h-4 w-4 text-slate-400" />
              </span>
              <p className="text-sm font-medium text-slate-800">No custom prices yet</p>
              <p className="max-w-md text-xs text-slate-500">
                Every account pays the platform price above (or its reseller&apos;s). Open a customer from
                Customers and use <span className="font-medium">Message prices</span> to give them their own.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search customers…"
                  aria-label="Search customers with custom prices"
                  className={cn(adminInputClass, "h-9 pl-9")}
                />
              </div>

              <div className="scrollbar-slim overflow-x-auto">
                <table className="w-full min-w-[40rem] text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">Customer</th>
                      {["WA_MARKETING", "WA_UTILITY", "WA_AUTHENTICATION"].map((c) => (
                        <th key={c} className="px-3 py-2 font-medium">{RATE_LONG_LABEL[c].replace("WhatsApp — ", "")}</th>
                      ))}
                      <th className="px-3 py-2 font-medium">Changed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {customers.map((c) => (
                      <tr key={c.tenant.id} className="hover:bg-slate-50/60">
                        <td className="px-3 py-2">
                          <Link href={`/tenants/${c.tenant.id}`} className="font-medium text-slate-900 hover:text-[#0B6E4F] hover:underline">
                            {c.tenant.name}
                          </Link>
                          <p className="text-xs text-slate-500">
                            {c.tenant.slug}
                            {c.tenant.parentId && " · under a reseller"}
                          </p>
                        </td>
                        {["WA_MARKETING", "WA_UTILITY", "WA_AUTHENTICATION"].map((cat) => {
                          const rate = c.rates.find((r) => r.category === cat);
                          const own = rate?.customerMinor ?? null;
                          return (
                            <td key={cat} className="px-3 py-2">
                              {own === null ? (
                                <span className="text-xs text-slate-400">
                                  {rate ? SOURCE_LABEL[rate.source] : "—"}
                                </span>
                              ) : (
                                <span className="flex flex-wrap items-center gap-1.5">
                                  <span className="tabular-nums font-medium text-slate-900">{paise(own)}</span>
                                  <AdminBadge tone="emerald">custom</AdminBadge>
                                </span>
                              )}
                            </td>
                          );
                        })}
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500">{formatDate(c.updatedAt)}</td>
                      </tr>
                    ))}
                    {customers.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-400">
                          No customers match &ldquo;{search}&rdquo;
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </AdminPanel>
      </div>
    </>
  );
}
