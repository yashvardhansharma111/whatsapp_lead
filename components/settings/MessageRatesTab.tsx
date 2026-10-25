"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { Button, Card, Field, inputClass } from "@/components/ui";

type Rate = { category: string; priceMinor: number; id: string | null };

const CATEGORY_LABELS: Record<string, { label: string; description: string }> = {
  WA_MARKETING:      { label: "Marketing",      description: "Promotional campaigns, offers and announcements" },
  WA_UTILITY:        { label: "Utility",        description: "Transactional messages, order updates, alerts" },
  WA_AUTHENTICATION: { label: "Authentication", description: "OTPs and account verification messages" },
};

export function MessageRatesTab() {
  const qc = useQueryClient();

  const { data: rates, isLoading } = useQuery<Rate[]>({
    queryKey: ["message-rates"],
    queryFn: async () => {
      const r = await fetch("/api/settings/message-rates");
      const j = await r.json();
      return Array.isArray(j.data) ? j.data : [];
    },
  });

  // prices stored as rupee strings so the user sees "0.75" not "75"
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [seeded, setSeeded] = useState(false);
  if (rates && !seeded) {
    setSeeded(true);
    const init: Record<string, string> = {};
    rates.forEach((r) => {
      init[r.category] = (r.priceMinor / 100).toFixed(2);
    });
    setPrices(init);
  }

  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: async () => {
      const payload = Object.entries(prices).map(([category, val]) => ({
        category,
        priceMinor: Math.round(parseFloat(val || "0") * 100),
      }));
      const r = await fetch("/api/settings/message-rates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rates: payload }),
      });
      if (!r.ok) {
        const j = await r.json();
        throw new Error(j.error ?? "Save failed");
      }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["message-rates"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-48 rounded-xl bg-slate-100" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <h2 className="font-semibold text-slate-900">Message Rates</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Platform cost per WhatsApp message in each category. Enter amounts in rupees (e.g.{" "}
          <span className="font-mono">0.75</span> = ₹0.75). These are the base rates charged to
          all tenants when no reseller override applies.
        </p>

        <div className="mt-5 space-y-4">
          {Object.entries(CATEGORY_LABELS).map(([cat, { label, description }]) => (
            <Field key={cat} label={label} htmlFor={`rate-${cat}`}>
              <p className="mb-1.5 text-xs text-slate-500">{description}</p>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-600">₹</span>
                <input
                  id={`rate-${cat}`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={prices[cat] ?? "0.00"}
                  onChange={(e) => setPrices((p) => ({ ...p, [cat]: e.target.value }))}
                  className={`${inputClass} max-w-[160px]`}
                  placeholder="0.00"
                />
                <span className="text-xs text-slate-400">
                  = {Math.round(parseFloat(prices[cat] || "0") * 100)} paise
                </span>
              </div>
            </Field>
          ))}
        </div>

        {save.error && (
          <p className="mt-3 text-sm text-rose-600">{(save.error as Error).message}</p>
        )}

        <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            <Save className="h-4 w-4" />
            {save.isPending ? "Saving…" : saved ? "Saved!" : "Save Rates"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
