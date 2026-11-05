"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Search, Smartphone } from "lucide-react";
import { Button, Card, EmptyState, PageHeader, Skeleton, inputClass } from "@/components/ui";
import { cn } from "@/lib/utils";

interface NumberRow {
  phone: string;
  name: string | null;
  totalSent: number;
  delivered: number;
  read: number;
  replied: number;
  failed: number;
  lastSentAt: string | null;
  campaigns: number;
}

type View = "mine" | "clients" | "platform";

const PAGE_SIZE = 50;

/**
 * How often each number has been messaged.
 *
 * Campaign reports say how one send went; this says how much a given person is being
 * messaged across all of them, which is the figure that matters for not burning a
 * number's quality rating. Sorted by volume, because the rows worth acting on are the
 * ones at the top.
 */
export default function NumberActivityPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const accountType = (session?.user as { accountType?: string } | undefined)?.accountType;

  const isSuperAdmin = role === "SUPER_ADMIN";
  const isReseller = accountType === "RESELLER" && !isSuperAdmin;

  const [view, setView] = useState<View>(isReseller ? "clients" : "mine");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useQuery<{ rows: NumberRow[]; total: number }>({
    queryKey: ["number-activity", view, debounced, page],
    queryFn: async () => {
      const q = new URLSearchParams({ view, page: String(page), limit: String(PAGE_SIZE) });
      if (debounced) q.set("search", debounced);
      const res = await fetch(`/api/analytics/number-activity?${q}`);
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to load");
      return json?.data ?? json;
    },
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Only offered where it means something: a plain workspace has one scope to look at.
  const views: { value: View; label: string }[] = [
    ...(isReseller ? [] : [{ value: "mine" as View, label: "This department" }]),
    ...(isReseller ? [{ value: "clients" as View, label: "My clients" }] : []),
    ...(isSuperAdmin ? [{ value: "platform" as View, label: "Whole platform" }] : []),
  ];

  return (
    <div>
      <PageHeader
        title="Messages per number"
        description="How often each number has been messaged across every campaign, busiest first."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {views.length > 1 && (
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
            {views.map((v) => (
              <button
                key={v.value}
                type="button"
                onClick={() => { setView(v.value); setPage(1); }}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition",
                  view === v.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700",
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
        )}
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search a number"
            className={`${inputClass} pl-9`}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Smartphone}
          title="Nothing sent yet"
          description="Once broadcasts have gone out, every number appears here with its history."
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Number</th>
                  <th className="px-3 py-2 text-right font-medium">Sent</th>
                  <th className="px-3 py-2 text-right font-medium">Delivered</th>
                  <th className="px-3 py-2 text-right font-medium">Read</th>
                  <th className="px-3 py-2 text-right font-medium">Replied</th>
                  <th className="px-3 py-2 text-right font-medium">Failed</th>
                  <th className="px-3 py-2 text-right font-medium">Campaigns</th>
                  <th className="px-3 py-2 font-medium">Last sent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {rows.map((r) => (
                  <tr key={r.phone} className="hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <span className="block text-slate-900">{r.name || r.phone}</span>
                      {r.name && <span className="block text-[11px] text-slate-400">{r.phone}</span>}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-slate-900">{r.totalSent}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{r.delivered}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{r.read}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{r.replied}</td>
                    <td className={cn("px-3 py-2 text-right", r.failed > 0 ? "text-rose-600" : "text-slate-400")}>
                      {r.failed}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600">{r.campaigns}</td>
                    <td className="px-3 py-2 text-slate-500">
                      {r.lastSentAt ? new Date(r.lastSentAt).toLocaleDateString(undefined, {
                        day: "numeric", month: "short", year: "numeric",
                      }) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Page {page} of {pages} · {total.toLocaleString()} number{total === 1 ? "" : "s"}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
