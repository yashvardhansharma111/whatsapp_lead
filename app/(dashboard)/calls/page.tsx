"use client";

import { useState } from "react";
import Link from "next/link";
import { Phone, PhoneIncoming, PhoneMissed, PhoneOff, PhoneOutgoing } from "lucide-react";
import { Avatar, Badge, Button, Card, EmptyState, PageHeader, Skeleton } from "@/components/ui";
import { useCallHistory, type CallRow } from "@/hooks/useCalls";
import { useFeature } from "@/hooks/useFeature";
import { formatCallDuration } from "@/lib/calls/webrtc";
import { cn, formatDate, formatTime } from "@/lib/utils";

const STATUS_STYLE: Record<CallRow["status"], string> = {
  RINGING:     "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  CONNECTING:  "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  IN_PROGRESS: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  COMPLETED:   "bg-slate-100 text-slate-700 ring-slate-500/20",
  MISSED:      "bg-rose-50 text-rose-700 ring-rose-600/20",
  REJECTED:    "bg-amber-50 text-amber-800 ring-amber-600/20",
  FAILED:      "bg-rose-50 text-rose-700 ring-rose-600/20",
};

const STATUS_LABEL: Record<CallRow["status"], string> = {
  RINGING: "Ringing", CONNECTING: "Connecting", IN_PROGRESS: "In progress",
  COMPLETED: "Completed", MISSED: "Missed", REJECTED: "Declined", FAILED: "Failed",
};

const FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All calls" },
  { value: "MISSED", label: "Missed" },
  { value: "COMPLETED", label: "Completed" },
  { value: "REJECTED", label: "Declined" },
  { value: "FAILED", label: "Failed" },
];

function StatusIcon({ call }: { call: CallRow }) {
  const cls = "h-4 w-4";
  if (call.status === "MISSED") return <PhoneMissed className={cn(cls, "text-rose-500")} />;
  if (call.status === "REJECTED" || call.status === "FAILED") return <PhoneOff className={cn(cls, "text-slate-400")} />;
  if (call.direction === "OUTBOUND") return <PhoneOutgoing className={cn(cls, "text-emerald-600")} />;
  return <PhoneIncoming className={cn(cls, "text-emerald-600")} />;
}

export default function CallsPage() {
  const enabled = useFeature("callingEnabled");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error } = useCallHistory({ status: status || undefined, page });

  const rows = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div>
      <PageHeader title="Calls" description="WhatsApp voice calls answered from the inbox." />

      {!enabled && (
        <Card className="mb-4 border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          WhatsApp calling isn&apos;t on your plan. Upgrade to receive customer calls in the inbox.
        </Card>
      )}

      <Card className="mb-4 flex flex-wrap items-center gap-2 p-3">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => { setStatus(f.value); setPage(1); }}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition",
              status === f.value ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20" : "text-slate-600 hover:bg-slate-50",
            )}
          >
            {f.label}
          </button>
        ))}
      </Card>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : isError ? (
          <EmptyState icon={PhoneOff} title="Couldn't load calls" description={error instanceof Error ? error.message : undefined} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Phone}
            title="No calls yet"
            description="When a customer calls your WhatsApp number, it rings here and the call appears in this log."
          />
        ) : (
          <div className="scrollbar-slim overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Contact</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Duration</th>
                  <th className="px-4 py-2.5 font-medium">Answered by</th>
                  <th className="px-4 py-2.5 font-medium">When</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((c) => {
                  const name = c.contact.name || c.contact.phone;
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <StatusIcon call={c} />
                          <Avatar name={name} src={c.contact.avatarUrl} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-900">{name}</p>
                            {c.contact.name && <p className="truncate text-xs text-slate-500">+{c.contact.phone}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge className={STATUS_STYLE[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                        {c.errorTitle && <p className="mt-0.5 max-w-56 truncate text-xs text-rose-600">{c.errorTitle}</p>}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-slate-700">
                        {c.durationSec != null && c.status === "COMPLETED" ? formatCallDuration(c.durationSec) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-700">{c.answeredBy?.name ?? "—"}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">
                        {formatDate(c.ringingAt)} · {formatTime(c.ringingAt)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {c.conversationId && (
                          <Link href={`/inbox?c=${c.conversationId}`} className="text-xs font-medium text-emerald-700 hover:underline">
                            Open chat
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
            <span>Page {pagination.page} of {pagination.totalPages} · {pagination.total} calls</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="secondary" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
