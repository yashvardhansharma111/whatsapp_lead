"use client";

import { useQuery } from "@tanstack/react-query";
import { Info, Receipt } from "lucide-react";
import { Card } from "@/components/ui";
import {
  RATE_HINT, RATE_LABEL, SOURCE_LABEL, SOURCE_TONE, paise, type RateSource,
} from "@/lib/billing/rates";
import { cn } from "@/lib/utils";

interface EffectiveRate {
  category: string;
  priceMinor: number;
  source: RateSource;
}

/**
 * What this workspace is charged per message, and where each price comes from.
 *
 * Read-only by design: pricing is set by the platform (or by the reseller that manages
 * this account), not by the account itself. This tab used to be an editable form writing
 * the platform-wide rows, which let any workspace admin rewrite everyone's prices.
 */
export function MessageRatesTab() {
  const { data: rates, isLoading, isError } = useQuery<EffectiveRate[]>({
    queryKey: ["message-rates"],
    queryFn: async () => {
      const r = await fetch("/api/settings/message-rates");
      const j = await r.json();
      if (!r.ok || j?.success === false) throw new Error(j?.error ?? "Couldn't load message prices");
      return Array.isArray(j.data) ? j.data : [];
    },
  });

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-48 rounded-xl bg-slate-100" />
      </div>
    );
  }

  const hasCustom = rates?.some((r) => r.source === "customer");

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Message prices</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            What your wallet is charged per WhatsApp template message sent by a campaign or broadcast.
            Inbox replies are never charged.
          </p>
        </div>

        {isError ? (
          <p className="px-5 py-6 text-sm text-rose-600">Couldn&apos;t load your message prices. Try again in a moment.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {(rates ?? []).map((r) => (
              <li key={r.category} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">{RATE_LABEL[r.category] ?? r.category}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{RATE_HINT[r.category]}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-base font-semibold tabular-nums text-slate-900">
                    {r.source === "unpriced" ? "Free" : paise(r.priceMinor)}
                  </span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", SOURCE_TONE[r.source])}>
                    {SOURCE_LABEL[r.source]}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-start gap-1.5 border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-xs text-slate-500">
          {hasCustom ? (
            <>
              <Receipt className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Your account has negotiated pricing on at least one category. To change it, talk to your
                account manager.
              </span>
            </>
          ) : (
            <>
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>Prices are set by the platform. Contact your account manager to discuss a custom rate.</span>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
