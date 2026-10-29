"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollText, ChevronLeft, ChevronRight } from "lucide-react";
import { Button, Card, EmptyState, Skeleton } from "@/components/ui";
import { timeAgo } from "@/lib/utils";

type AuditLog = {
  id: string;
  action: string;
  actor: string | null;
  actorRole: string | null;
  details: string | null;
  ip: string | null;
  createdAt: string;
};

type AuditResponse = {
  logs: AuditLog[];
  total: number;
  page: number;
  limit: number;
};

const ACTION_COLOR: Record<string, string> = {
  CREATE: "bg-emerald-50 text-emerald-700",
  UPDATE: "bg-sky-50 text-sky-700",
  DELETE: "bg-rose-50 text-rose-700",
  LOGIN:  "bg-violet-50 text-violet-700",
  EXPORT: "bg-amber-50 text-amber-700",
};

function actionTone(action: string) {
  const prefix = action.split("_")[0];
  return ACTION_COLOR[prefix] ?? "bg-slate-100 text-slate-600";
}

function prettyAction(action: string) {
  return action.toLowerCase().replace(/_/g, " ");
}

export function ActivityTab() {
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = useQuery<AuditResponse>({
    queryKey: ["account-audit-logs", page],
    queryFn: async () => {
      const r = await fetch(`/api/account/audit-logs?page=${page}&limit=${limit}`);
      const j = await r.json();
      if (!r.ok || j.success === false) throw new Error(j.error ?? "Failed to load");
      return j.data ?? j;
    },
    staleTime: 30_000,
  });

  const totalPages = data ? Math.ceil(data.total / limit) : 1;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Activity log</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Recent actions performed in this workspace.
        </p>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : !data || data.logs.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="No activity yet"
            description="Actions in this workspace will appear here."
          />
        ) : (
          <>
            <div className="scrollbar-slim overflow-x-auto">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Action</th>
                    <th className="px-5 py-3 font-medium">By</th>
                    <th className="px-5 py-3 font-medium">Details</th>
                    <th className="px-5 py-3 font-medium text-right">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${actionTone(log.action)}`}>
                          {prettyAction(log.action)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-700">
                        <span className="font-medium">{log.actor ?? "System"}</span>
                        {log.actorRole && (
                          <span className="ml-1 text-xs text-slate-400">({log.actorRole.toLowerCase()})</span>
                        )}
                      </td>
                      <td className="max-w-xs px-5 py-3 text-slate-500">
                        <span className="line-clamp-1">{log.details ?? "—"}</span>
                      </td>
                      <td className="px-5 py-3 text-right text-xs text-slate-400" title={log.createdAt}>
                        {timeAgo(new Date(log.createdAt))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
                <p className="text-xs text-slate-400">
                  Page {data.page} of {totalPages} · {data.total} entries
                </p>
                <div className="flex gap-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
