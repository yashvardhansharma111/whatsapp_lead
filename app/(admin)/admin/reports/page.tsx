"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Building2, MessageSquare, Megaphone, Users,
  Download, TrendingUp, TrendingDown, ArrowUpRight,
  Wallet,
} from "lucide-react";
import { Card } from "@/components/ui";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReportData {
  period:    { from: string; to: string };
  tenants:   { total: number; new: number };
  messages:  { total: number; inbound: number; outbound: number; daily: { date: string; count: number }[] };
  campaigns: { total: number; completed: number };
  contacts:  { total: number; new: number };
  wallet:    { creditsMinor: number; debitsMinor: number };
  topTenants: { tenantId: string; tenantName: string; slug: string; messages: number }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatINR = (paise: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(paise / 100);

const PRESETS = [
  { label: "Last 7 days",   days: 7 },
  { label: "Last 30 days",  days: 30 },
  { label: "Last 90 days",  days: 90 },
  { label: "Last 12 months", days: 365 },
];

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
        </div>
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", color)}>
          <Icon className="h-4.5 w-4.5" />
        </span>
      </div>
    </Card>
  );
}

// ─── Simple bar chart ─────────────────────────────────────────────────────────

function MiniBarChart({ data }: { data: { date: string; count: number }[] }) {
  if (!data.length) return <p className="py-4 text-center text-sm text-slate-400">No data for this period</p>;
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="flex h-24 items-end gap-px overflow-hidden">
      {data.map((d) => (
        <div
          key={d.date}
          title={`${d.date}: ${d.count}`}
          className="flex-1 min-w-0 rounded-t bg-emerald-500 opacity-80 hover:opacity-100 transition-opacity"
          style={{ height: `${Math.max(4, (d.count / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const today = new Date();
  const [preset, setPreset] = useState(1); // default: last 30 days
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo]     = useState("");

  const from = customFrom || isoDate(new Date(Date.now() - PRESETS[preset].days * 86_400_000));
  const to   = customTo   || isoDate(today);

  const { data, isLoading, isError } = useQuery<ReportData>({
    queryKey: ["admin-reports", from, to],
    queryFn: async () => {
      const res = await fetch(`/api/admin/reports?from=${from}&to=${to}`);
      const j   = await res.json();
      if (!res.ok) throw new Error(j.message ?? "Failed");
      return (j.data ?? j) as ReportData;
    },
  });

  function downloadCsv() {
    window.open(`/api/admin/reports/export?from=${from}&to=${to}`, "_blank");
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Platform Reports</h1>
          <p className="text-sm text-slate-500">Detailed metrics across all tenants</p>
        </div>
        <button
          onClick={downloadCsv}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <Download className="h-4 w-4" />
          Download CSV
        </button>
      </div>

      {/* Date range controls */}
      <Card className="mb-6 flex flex-wrap items-center gap-2 p-3">
        {PRESETS.map((p, i) => (
          <button
            key={p.label}
            onClick={() => { setPreset(i); setCustomFrom(""); setCustomTo(""); }}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition",
              preset === i && !customFrom
                ? "bg-emerald-600 text-white"
                : "text-slate-600 hover:bg-slate-100",
            )}
          >
            {p.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            max={customTo || isoDate(today)}
            className="h-8 rounded-lg border border-slate-200 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <span className="text-xs text-slate-400">to</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            min={customFrom}
            max={isoDate(today)}
            className="h-8 rounded-lg border border-slate-200 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : isError || !data ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Failed to load report data.
        </p>
      ) : (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            <StatCard
              icon={Building2}
              label="Total Customers"
              value={data.tenants.total.toLocaleString()}
              sub={`+${data.tenants.new} new this period`}
              color="bg-blue-50 text-blue-600"
            />
            <StatCard
              icon={MessageSquare}
              label="Messages"
              value={data.messages.total.toLocaleString()}
              sub={`↑${data.messages.inbound.toLocaleString()} in  ↓${data.messages.outbound.toLocaleString()} out`}
              color="bg-emerald-50 text-emerald-600"
            />
            <StatCard
              icon={Megaphone}
              label="Campaigns"
              value={data.campaigns.total.toLocaleString()}
              sub={`${data.campaigns.completed} completed`}
              color="bg-violet-50 text-violet-600"
            />
            <StatCard
              icon={Users}
              label="Contacts"
              value={data.contacts.total.toLocaleString()}
              sub={`+${data.contacts.new} new this period`}
              color="bg-amber-50 text-amber-600"
            />
            <StatCard
              icon={TrendingUp}
              label="Wallet Credits"
              value={formatINR(Number(data.wallet.creditsMinor))}
              color="bg-emerald-50 text-emerald-600"
            />
            <StatCard
              icon={TrendingDown}
              label="Wallet Debits"
              value={formatINR(Number(data.wallet.debitsMinor))}
              color="bg-rose-50 text-rose-600"
            />
            <StatCard
              icon={Wallet}
              label="Net Wallet"
              value={formatINR(Number(data.wallet.creditsMinor) - Number(data.wallet.debitsMinor))}
              color="bg-slate-100 text-slate-600"
            />
            <StatCard
              icon={ArrowUpRight}
              label="Msg / Tenant"
              value={
                data.tenants.total > 0
                  ? Math.round(data.messages.total / data.tenants.total).toLocaleString()
                  : "—"
              }
              sub="average per customer"
              color="bg-sky-50 text-sky-600"
            />
          </div>

          {/* Daily message chart */}
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">
              Daily Messages —{" "}
              <span className="font-normal text-slate-500">
                {from} to {to}
              </span>
            </h2>
            <MiniBarChart data={data.messages.daily} />
          </Card>

          {/* Top tenants by messages */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <h2 className="text-sm font-semibold text-slate-900">Top Customers by Messages</h2>
              <span className="text-xs text-slate-500">top 10 in period</span>
            </div>
            {data.topTenants.length === 0 ? (
              <p className="p-5 text-sm text-slate-400">No message activity in this period.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3 font-medium">#</th>
                      <th className="px-5 py-3 font-medium">Customer</th>
                      <th className="px-5 py-3 font-medium">Slug</th>
                      <th className="px-5 py-3 font-medium text-right">Messages</th>
                      <th className="px-5 py-3 font-medium text-right">Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.topTenants.map((t, i) => {
                      const pct = data.messages.total > 0
                        ? Math.round((t.messages / data.messages.total) * 100)
                        : 0;
                      return (
                        <tr key={t.tenantId} className="hover:bg-slate-50">
                          <td className="px-5 py-3 tabular-nums text-slate-400">{i + 1}</td>
                          <td className="px-5 py-3 font-medium text-slate-900">{t.tenantName}</td>
                          <td className="px-5 py-3 font-mono text-xs text-slate-500">{t.slug}</td>
                          <td className="px-5 py-3 text-right tabular-nums font-medium text-slate-900">
                            {t.messages.toLocaleString()}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className="h-full rounded-full bg-emerald-500"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="w-8 text-right tabular-nums text-xs text-slate-500">
                                {pct}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
