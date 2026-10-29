"use client";

// Super admin → one account's message prices. Shows what the account is charged per
// category, whether that comes from its own custom price or is inherited from its
// reseller / the platform, and lets an operator set or clear the custom price.
// Backed by /api/admin/tenants/[id]/rates.

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Info, RotateCcw } from "lucide-react";
import { AdminBadge, AdminButton, AdminPanel, AdminSkeletonRows, adminInputClass } from "@/components/admin/ui";
import {
  RATE_HINT, RATE_LABEL, SOURCE_LABEL, inheritedMinor, paise,
  type ResolvedRate, type RateSource,
} from "@/lib/billing/rates";
import { cn } from "@/lib/utils";

interface RatesPayload {
  tenant: { id: string; name: string; accountType: string; parent: { id: string; name: string } | null };
  rates: ResolvedRate[];
}

const SOURCE_TONE: Record<RateSource, "emerald" | "sky" | "slate" | "amber"> = {
  customer: "emerald",
  reseller: "sky",
  platform: "slate",
  unpriced: "amber",
};

export function TenantRatesPanel({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "tenant-rates", tenantId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/tenants/${tenantId}/rates`);
      if (!res.ok) throw new Error("Failed to load message prices");
      const json = await res.json();
      return (json.data ?? json) as RatesPayload;
    },
  });

  const save = useMutation({
    mutationFn: async (v: { category: string; priceMinor: number | null }) => {
      setBusy(v.category);
      setErrors((e) => { const n = { ...e }; delete n[v.category]; return n; });
      const res = await fetch(`/api/admin/tenants/${tenantId}/rates`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Save failed");
      return v.category;
    },
    onSettled: () => setBusy(null),
    onSuccess: (_d, v) => {
      setEdits((e) => { const n = { ...e }; delete n[v.category]; return n; });
      void qc.invalidateQueries({ queryKey: ["admin", "tenant-rates", tenantId] });
      void qc.invalidateQueries({ queryKey: ["admin", "rates"] });
    },
    onError: (err, v) => setErrors((e) => ({ ...e, [v.category]: (err as Error).message })),
  });

  const inheritsFrom = data?.tenant.parent ? `${data.tenant.parent.name} (reseller)` : "the platform";

  return (
    <AdminPanel
      title="Message prices"
      subtitle={`What this account pays per template message — set a custom price or let it inherit from ${inheritsFrom}`}
    >
      {isLoading || !data ? (
        <AdminSkeletonRows rows={3} />
      ) : (
        <div className="space-y-3">
          {data.rates.map((r) => {
            const inherited = inheritedMinor(r);
            const isCustom = r.customerMinor !== null;
            const value = edits[r.category] ?? (r.customerMinor === null ? "" : String(r.customerMinor));
            const dirty = r.category in edits;
            const saving = busy === r.category;

            return (
              <div key={r.category} className="flex flex-col gap-1.5 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                  <div className="min-w-0 lg:w-64">
                    <p className="text-sm font-medium text-slate-800">{RATE_LABEL[r.category] ?? r.category}</p>
                    <p className="text-xs text-slate-500">{RATE_HINT[r.category]}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      value={value}
                      placeholder={inherited === null ? "Not priced — free" : `Inherits ${inherited}`}
                      onChange={(e) => setEdits((x) => ({ ...x, [r.category]: e.target.value }))}
                      className={cn(adminInputClass, "h-10 w-36 sm:h-9 sm:w-44")}
                      aria-label={`Custom price for ${RATE_LABEL[r.category]}`}
                    />
                    <span className="text-xs text-slate-500">
                      paise{value !== "" && ` = ₹${(Number(value) / 100).toFixed(2)}`}
                    </span>

                    {dirty ? (
                      <AdminButton
                        size="sm"
                        disabled={saving}
                        onClick={() =>
                          save.mutate({
                            category: r.category,
                            priceMinor: value === "" ? null : Math.round(Number(value)),
                          })
                        }
                      >
                        {saving ? "Saving…" : "Save"}
                      </AdminButton>
                    ) : (
                      <AdminBadge tone={SOURCE_TONE[r.source]}>
                        {SOURCE_LABEL[r.source]} · {paise(r.source === "unpriced" ? null : r.priceMinor)}
                      </AdminBadge>
                    )}

                    {isCustom && !dirty && (
                      <AdminButton
                        size="sm"
                        variant="ghost"
                        disabled={saving}
                        onClick={() => save.mutate({ category: r.category, priceMinor: null })}
                        aria-label={`Remove the custom ${RATE_LABEL[r.category]} price`}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        {saving ? "Removing…" : `Use ${inherited === null ? "free" : `${inherited} paise`}`}
                      </AdminButton>
                    )}
                  </div>
                </div>
                {errors[r.category] && <p className="text-xs text-rose-700 lg:pl-64">{errors[r.category]}</p>}
              </div>
            );
          })}

          <p className="flex items-start gap-1.5 pt-1 text-xs text-slate-500">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Charged to this account&apos;s wallet per template message sent by a campaign or broadcast. Leave a
            field empty to inherit. Inbox replies are never charged.
          </p>
        </div>
      )}
    </AdminPanel>
  );
}
