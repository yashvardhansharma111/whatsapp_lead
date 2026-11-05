"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, TrendingDown, TrendingUp } from "lucide-react";
import { Button, Card, PageHeader, Skeleton, inputClass } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

interface PolicyOption {
  value: string;
  label: string;
  detail: string;
}
interface Policy {
  behaviour: string;
  graceDays: number;
  options: PolicyOption[];
}
interface PriceLine {
  id: string;
  label: string;
  before: number;
  after: number;
}
interface BulkResult {
  applied: boolean;
  rates: PriceLine[];
  plansMonthly: PriceLine[];
  plansAnnual: PriceLine[];
}

const money = (minor: number) => `₹${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

async function readJson<T>(res: Response, fallback: string): Promise<T> {
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error ?? fallback);
  return (json?.data ?? json) as T;
}

/**
 * Two platform-wide decisions that had no home: what happens when a plan runs out, and
 * moving every price at once.
 *
 * The price change is preview-first by construction — the form computes before applying,
 * and the apply button only appears once the whole set has been shown. A sweeping change
 * to what every customer pays is worth reading twice.
 */
export default function PricingPolicyPage() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const { data: policy, isLoading } = useQuery<Policy>({
    queryKey: ["plan-end-policy"],
    queryFn: async () => readJson<Policy>(await fetch("/api/admin/plan-end-policy"), "Failed to load"),
  });

  const [behaviour, setBehaviour] = useState<string | null>(null);
  const [graceDays, setGraceDays] = useState<number | null>(null);

  const savePolicy = useMutation({
    mutationFn: async () =>
      readJson(await fetch("/api/admin/plan-end-policy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          behaviour: behaviour ?? policy?.behaviour,
          graceDays: graceDays ?? policy?.graceDays,
        }),
      }), "Couldn't save"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plan-end-policy"] });
      showToast("Saved.", "success");
    },
    onError: (e: Error) => showToast(e.message, "error"),
  });

  // ── Bulk price change ──────────────────────────────────────────────────────
  const [mode, setMode] = useState<"percent" | "flat">("percent");
  const [amount, setAmount] = useState("");
  const [target, setTarget] = useState<"rates" | "plans" | "both">("rates");
  const [rounding, setRounding] = useState<"nearest" | "up" | "down">("nearest");
  const [preview, setPreview] = useState<BulkResult | null>(null);

  const bodyFor = (dryRun: boolean) => ({
    ...(mode === "percent" ? { percent: Number(amount) } : { flatMinor: Math.round(Number(amount) * 100) }),
    target, rounding, dryRun,
  });

  const bulk = useMutation({
    mutationFn: async (dryRun: boolean) =>
      readJson<BulkResult>(await fetch("/api/admin/rates/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyFor(dryRun)),
      }), "Couldn't change prices"),
    onSuccess: (res) => {
      if (res.applied) {
        setPreview(null);
        setAmount("");
        showToast("Prices updated.", "success");
      } else {
        setPreview(res);
      }
    },
    onError: (e: Error) => showToast(e.message, "error"),
  });

  const allLines = preview
    ? [...preview.rates, ...preview.plansMonthly, ...preview.plansAnnual].filter((l) => l.before !== l.after)
    : [];
  const unchanged = preview
    ? [...preview.rates, ...preview.plansMonthly, ...preview.plansAnnual].length - allLines.length
    : 0;

  return (
    <div>
      <PageHeader
        title="Pricing & plan policy"
        description="What happens when a plan runs out, and moving every price at once."
      />

      <Card className="mb-4 p-5">
        <h2 className="text-sm font-semibold text-slate-900">When a trial or plan runs out</h2>
        {isLoading || !policy ? (
          <Skeleton className="mt-3 h-24 rounded-lg" />
        ) : (
          <>
            <div className="mt-3 space-y-2">
              {policy.options.map((o) => {
                const chosen = (behaviour ?? policy.behaviour) === o.value;
                return (
                  <label
                    key={o.value}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition",
                      chosen ? "border-emerald-300 bg-emerald-50/60" : "border-slate-200 hover:bg-slate-50",
                    )}
                  >
                    <input
                      type="radio"
                      name="planEnd"
                      checked={chosen}
                      onChange={() => setBehaviour(o.value)}
                      className="mt-0.5 h-4 w-4 text-emerald-600"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-800">{o.label}</span>
                      <span className="block text-xs text-slate-500">{o.detail}</span>
                    </span>
                  </label>
                );
              })}
            </div>

            {(behaviour ?? policy.behaviour) !== "BLOCK" && (
              <div className="mt-3 flex items-center gap-2">
                <label htmlFor="grace" className="text-sm text-slate-700">Grace period</label>
                <input
                  id="grace"
                  type="number"
                  min={0}
                  max={90}
                  value={graceDays ?? policy.graceDays}
                  onChange={(e) => setGraceDays(Number(e.target.value))}
                  className={cn(inputClass, "w-24")}
                />
                <span className="text-sm text-slate-500">days</span>
              </div>
            )}

            <div className="mt-4">
              <Button onClick={() => savePolicy.mutate()} disabled={savePolicy.isPending}>
                {savePolicy.isPending ? "Saving…" : "Save policy"}
              </Button>
            </div>
          </>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900">Change every price at once</h2>
        <p className="mt-1 text-xs text-slate-500">
          Nothing is written until you have seen the full list and confirmed it.
        </p>

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="bulk-mode">Change by</label>
            <select id="bulk-mode" value={mode} onChange={(e) => { setMode(e.target.value as "percent" | "flat"); setPreview(null); }} className={cn(inputClass, "w-32")}>
              <option value="percent">Percent</option>
              <option value="flat">Amount</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="bulk-amount">
              {mode === "percent" ? "Percent (− to reduce)" : "Rupees (− to reduce)"}
            </label>
            <input
              id="bulk-amount"
              type="number"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setPreview(null); }}
              placeholder={mode === "percent" ? "e.g. 10" : "e.g. 0.50"}
              className={cn(inputClass, "w-40")}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="bulk-target">Apply to</label>
            <select id="bulk-target" value={target} onChange={(e) => { setTarget(e.target.value as typeof target); setPreview(null); }} className={cn(inputClass, "w-44")}>
              <option value="rates">Message rates</option>
              <option value="plans">Plan prices</option>
              <option value="both">Both</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="bulk-round">Rounding</label>
            <select id="bulk-round" value={rounding} onChange={(e) => { setRounding(e.target.value as typeof rounding); setPreview(null); }} className={cn(inputClass, "w-32")}>
              <option value="nearest">Nearest</option>
              <option value="up">Up</option>
              <option value="down">Down</option>
            </select>
          </div>
          <Button variant="secondary" onClick={() => bulk.mutate(true)} disabled={!amount || bulk.isPending}>
            {Number(amount) < 0 ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
            Preview
          </Button>
        </div>

        {preview && (
          <div className="mt-4 rounded-lg border border-slate-200">
            <div className="flex items-start gap-2 border-b border-slate-200 bg-amber-50 px-3 py-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-xs text-amber-800">
                {allLines.length.toLocaleString()} price{allLines.length === 1 ? "" : "s"} will change
                {unchanged > 0 && <> · {unchanged} unchanged (rounding left them where they were)</>}.
                This affects what every customer is billed.
              </p>
            </div>
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-sm tabular-nums">
                <tbody className="divide-y divide-slate-100">
                  {allLines.map((l, i) => (
                    <tr key={`${l.id}-${i}`}>
                      <td className="px-3 py-1.5 text-slate-700">{l.label}</td>
                      <td className="px-3 py-1.5 text-right text-slate-400 line-through">{money(l.before)}</td>
                      <td className="px-3 py-1.5 text-right font-medium text-slate-900">{money(l.after)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-3 py-2">
              <Button variant="secondary" onClick={() => setPreview(null)}>Cancel</Button>
              <Button onClick={() => bulk.mutate(false)} disabled={bulk.isPending || allLines.length === 0}>
                {bulk.isPending ? "Applying…" : `Apply to ${allLines.length}`}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
