"use client";

// Reseller → one client's message prices. The reseller may give a client its own price,
// but never below the platform price it pays itself, so a message can't be sold at a loss.
// Backed by /api/reseller/clients/[id]/rates.

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Info, RotateCcw } from "lucide-react";
import { Button, Card, SkeletonRows, inputClass } from "@/components/ui";
import { api } from "@/components/reseller/shared";
import {
  RATE_HINT, RATE_LABEL, SOURCE_LABEL, SOURCE_TONE, inheritedMinor, paise, type ResolvedRate,
} from "@/lib/billing/rates";
import { cn } from "@/lib/utils";

export function ClientRatesCard({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["reseller", "client-rates", clientId],
    queryFn: () => api<{ data: { client: { id: string; name: string }; rates: ResolvedRate[] } }>(`/api/reseller/clients/${clientId}/rates`),
  });

  const save = useMutation({
    mutationFn: async (v: { category: string; priceMinor: number | null }) => {
      setBusy(v.category);
      setErrors((e) => { const n = { ...e }; delete n[v.category]; return n; });
      await api(`/api/reseller/clients/${clientId}/rates`, { method: "PUT", json: v });
      return v.category;
    },
    onSettled: () => setBusy(null),
    onSuccess: (_d, v) => {
      setEdits((e) => { const n = { ...e }; delete n[v.category]; return n; });
      void qc.invalidateQueries({ queryKey: ["reseller", "client-rates", clientId] });
      void qc.invalidateQueries({ queryKey: ["reseller", "rates"] });
    },
    onError: (err, v) => setErrors((e) => ({ ...e, [v.category]: (err as Error).message })),
  });

  const rates = data?.data.rates ?? [];

  return (
    <Card className="p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-slate-900">Message prices for this client</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        Leave a field empty to charge your standard price. You can discount a client, but not below the
        platform price you pay.
      </p>

      {isLoading ? (
        <div className="mt-3"><SkeletonRows rows={3} /></div>
      ) : isError ? (
        <p className="mt-3 text-sm text-rose-700">{(error as Error).message}</p>
      ) : (
        <div className="mt-3 space-y-3">
          {rates.map((r) => {
            const inherited = inheritedMinor(r);
            const isCustom = r.customerMinor !== null;
            const value = edits[r.category] ?? (r.customerMinor === null ? "" : String(r.customerMinor));
            const dirty = r.category in edits;
            const saving = busy === r.category;

            return (
              <div key={r.category} className="flex flex-col gap-1.5 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="min-w-0 sm:w-44">
                    <p className="text-sm font-medium text-slate-800">{RATE_LABEL[r.category] ?? r.category}</p>
                    <p className="text-xs text-slate-500">{RATE_HINT[r.category]}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      min={r.platformMinor ?? 0}
                      value={value}
                      placeholder={inherited === null ? "Not priced — free" : `Standard ${inherited}`}
                      onChange={(e) => setEdits((x) => ({ ...x, [r.category]: e.target.value }))}
                      className={cn(inputClass, "h-10 w-32 sm:h-9 sm:w-36")}
                      aria-label={`Price for ${RATE_LABEL[r.category]}`}
                    />
                    <span className="text-xs text-slate-500">
                      paise{value !== "" && ` = ₹${(Number(value) / 100).toFixed(2)}`}
                    </span>

                    {dirty ? (
                      <Button
                        size="sm"
                        disabled={saving}
                        onClick={() =>
                          save.mutate({ category: r.category, priceMinor: value === "" ? null : Math.round(Number(value)) })
                        }
                      >
                        {saving ? "Saving…" : "Save"}
                      </Button>
                    ) : (
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", SOURCE_TONE[r.source])}>
                        {SOURCE_LABEL[r.source]} · {paise(r.source === "unpriced" ? null : r.priceMinor)}
                      </span>
                    )}

                    {isCustom && !dirty && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={saving}
                        onClick={() => save.mutate({ category: r.category, priceMinor: null })}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Use standard
                      </Button>
                    )}
                  </div>
                </div>
                {errors[r.category] && <p className="text-xs text-rose-700 sm:pl-44">{errors[r.category]}</p>}
              </div>
            );
          })}

          <p className="flex items-start gap-1.5 text-xs text-slate-500">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Charged to this client&apos;s wallet per template message their campaigns send.
          </p>
        </div>
      )}
    </Card>
  );
}
