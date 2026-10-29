"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, ArrowRight, Bot, Check, Clock, Inbox, Loader2, MessageSquare,
  RotateCcw, UserCheck, Users,
} from "lucide-react";
import { Badge, Button, Card, EmptyState, PageHeader, SkeletonRows } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { usePermissions } from "@/hooks/usePermissions";
import {
  REASON_LABELS,
  useAcceptHandover, useCancelHandover, useDepartments, useHandovers, useResolveHandover,
  type Handover, type HandoverStatus,
} from "@/hooks/useHandovers";
import { cn, timeAgo } from "@/lib/utils";

const STATUS_STYLE: Record<HandoverStatus, string> = {
  PENDING:   "bg-rose-50 text-rose-700 ring-rose-600/20",
  ASSIGNED:  "bg-amber-50 text-amber-800 ring-amber-600/20",
  ACCEPTED:  "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  RESOLVED:  "bg-slate-100 text-slate-600 ring-slate-500/20",
  CANCELLED: "bg-slate-100 text-slate-500 ring-slate-400/20",
};

const STATUS_LABEL: Record<HandoverStatus, string> = {
  PENDING:   "Nobody assigned",
  ASSIGNED:  "Waiting to be opened",
  ACCEPTED:  "Being handled",
  RESOLVED:  "Done",
  CANCELLED: "Back with the AI",
};

const TABS: { key: string; label: string }[] = [
  { key: "OPEN",      label: "Needs a person" },
  { key: "ACCEPTED",  label: "Being handled" },
  { key: "RESOLVED",  label: "Done" },
  { key: "ALL",       label: "Everything" },
];

/**
 * The clock, read once a minute.
 *
 * A queue is one of the few screens where elapsed time is the content, so it counts up on
 * its own rather than only moving when something else causes a render.
 */
function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** How long someone has been waiting, and whether that is long enough to worry. */
function Waiting({ handover, now }: { handover: Handover; now: number }) {
  const settled = handover.status === "RESOLVED" || handover.status === "CANCELLED";
  if (settled) return <span className="text-xs text-slate-400">{timeAgo(handover.requestedAt)}</span>;

  const minutes = Math.floor((now - new Date(handover.requestedAt).getTime()) / 60000);
  const late = minutes >= 15 || Boolean(handover.escalatedAt);

  return (
    <span className={cn(
      "inline-flex items-center gap-1 text-xs tabular-nums",
      late ? "font-medium text-rose-600" : "text-slate-500",
    )}>
      {late ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
      {minutes < 1 ? "just now" : minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`}
    </span>
  );
}

export default function HandoversPage() {
  const { can, loaded } = usePermissions();
  const canSee = can("conversations.view");
  const { showToast } = useToast();

  const now = useNow();
  const [tab, setTab] = useState("OPEN");
  const [departmentId, setDepartmentId] = useState("ALL");
  const [mine, setMine] = useState(false);

  const filters = useMemo(() => ({
    // "Needs a person" is two statuses, so the server filter is left off and the rows
    // are narrowed here. Everything else maps straight through.
    status: tab === "OPEN" || tab === "ALL" ? "ALL" : tab,
    departmentId,
    assignedToId: mine ? "me" : undefined,
  }), [tab, departmentId, mine]);

  const { data, isLoading, isError, error } = useHandovers(filters);
  const { data: departments = [] } = useDepartments();
  const accept  = useAcceptHandover();
  const resolve = useResolveHandover();
  const cancel  = useCancelHandover();

  const rows = useMemo(() => {
    const all = data?.handovers ?? [];
    return tab === "OPEN" ? all.filter((h) => h.status === "PENDING" || h.status === "ASSIGNED") : all;
  }, [data, tab]);

  const act = (
    run: { mutateAsync: (id: string) => Promise<unknown>; isPending: boolean },
    id: string, done: string,
  ) => {
    run.mutateAsync(id)
      .then(() => showToast(done, "success"))
      .catch((e: Error) => showToast(e.message, "error"));
  };

  if (loaded && !canSee) {
    return (
      <div>
        <PageHeader title="Handovers" description="Conversations the AI has passed to a person." />
        <Card className="p-8 text-center">
          <UserCheck className="mx-auto h-6 w-6 text-slate-400" />
          <p className="mt-3 text-sm font-medium text-slate-900">This queue isn&apos;t open to you</p>
          <p className="mt-1 text-sm text-slate-500">
            Seeing conversations needs the Conversations permission in this workspace.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Handovers"
        description="Conversations the AI has passed to a person, and who has them."
        action={
          data?.waiting ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 px-2.5 py-1.5 text-sm font-medium text-rose-700">
              <AlertTriangle className="h-4 w-4" />
              {data.waiting} waiting
            </span>
          ) : null
        }
      />

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg bg-slate-100 p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition",
                tab === t.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {departments.length > 0 && (
          <select
            aria-label="Department"
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700"
          >
            <option value="ALL">Every department</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        )}

        <button
          onClick={() => setMine((v) => !v)}
          aria-pressed={mine}
          className={cn(
            "rounded-lg border px-2.5 py-1.5 text-sm font-medium transition",
            mine
              ? "border-emerald-300 bg-emerald-50 text-emerald-700"
              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
          )}
        >
          Only mine
        </button>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-4"><SkeletonRows rows={4} /></div>
        ) : isError ? (
          <EmptyState
            icon={AlertTriangle}
            title="Couldn't load the queue"
            description={(error as Error)?.message ?? "Something went wrong. Try again in a moment."}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={tab === "OPEN" ? "Nobody is waiting" : "Nothing here"}
            description={
              tab === "OPEN"
                ? "When the AI passes a conversation to a person, it shows up here with the reason."
                : "No handovers match these filters."
            }
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((h) => {
              const contact = h.conversation?.contact;
              const open = h.status === "PENDING" || h.status === "ASSIGNED";
              const busy = accept.isPending || resolve.isPending || cancel.isPending;

              return (
                <li key={h.id} className="p-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <span className={cn(
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                      h.status === "PENDING" ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-500",
                    )}>
                      <Bot className="h-4 w-4" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-slate-900">
                          {contact?.name?.trim() || (contact?.phone ? `+${contact.phone}` : "Unknown contact")}
                        </p>
                        <Badge className={STATUS_STYLE[h.status]}>{STATUS_LABEL[h.status]}</Badge>
                        {h.department && (
                          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                            <Users className="h-3 w-3" />
                            {h.department.name}
                          </span>
                        )}
                        {h.escalatedAt && (
                          <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium text-rose-700">
                            Escalated
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-sm text-slate-600">
                        {REASON_LABELS[h.reason] ?? "Handed over"}
                        {h.note?.trim() ? ` · ${h.note}` : ""}
                      </p>

                      {h.trigger?.trim() && (
                        <p className="mt-1 line-clamp-2 rounded-md bg-slate-50 px-2 py-1 text-xs italic text-slate-500">
                          &ldquo;{h.trigger}&rdquo;
                        </p>
                      )}

                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <Waiting handover={h} now={now} />
                        {h.assignedTo && (
                          <span className="text-xs text-slate-500">with {h.assignedTo.name}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      {h.conversation && (
                        <Link href={`/inbox?c=${h.conversationId}`}>
                          <Button variant="secondary" size="sm">
                            <MessageSquare className="h-3.5 w-3.5" />
                            Open chat
                            <ArrowRight className="h-3 w-3" />
                          </Button>
                        </Link>
                      )}
                      {open && (
                        <Button size="sm" disabled={busy} onClick={() => act(accept, h.id, "It's yours now.")}>
                          {accept.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                          Take it
                        </Button>
                      )}
                      {(open || h.status === "ACCEPTED") && (
                        <>
                          <Button variant="secondary" size="sm" disabled={busy}
                            onClick={() => act(resolve, h.id, "Marked as done.")}>
                            Done
                          </Button>
                          <Button variant="ghost" size="sm" disabled={busy}
                            title="Give the conversation back to the AI"
                            onClick={() => act(cancel, h.id, "Back with the AI.")}>
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
