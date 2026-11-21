"use client";

import {
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  useCampaignsRealtime,
} from "@/hooks/useCampaignsRealtime";
import {
  Megaphone,
  Plus,
  Play,
  Pause,
  Copy,
  Trash2,
  CalendarClock,
  Loader2,
  AlertCircle,
  Eye,
} from "lucide-react";
type CampaignStatus = "DRAFT" | "SCHEDULED" | "RUNNING" | "COMPLETED" | "FAILED" | "PAUSED" | "CANCELLED";
type Campaign = { id: string; name: string; status: CampaignStatus; scheduledAt?: string | null; createdAt: string; totalCount: number; sentCount: number; deliveredCount: number; readCount: number; clickedCount?: number; repliedCount: number; failedCount: number; [key: string]: unknown; };
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Modal,
  PageHeader,
  SkeletonRows,
} from "@/components/ui";
import {
  useToast,
} from "@/components/ui/toast";
import {
  ExportButton,
} from "@/components/ExportButton";
import {
  cn,
  formatCompact,
  formatDate,
} from "@/lib/utils";
import {
} from "@/lib/campaigns/templateVars";

// ─── Types ────────────────────────────────────────────────────────────────────


// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<CampaignStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-600 ring-slate-500/20",
  SCHEDULED: "bg-sky-50 text-sky-700 ring-sky-600/20",
  RUNNING: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  COMPLETED: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  FAILED: "bg-rose-50 text-rose-700 ring-rose-600/20",
  PAUSED: "bg-amber-50 text-amber-800 ring-amber-600/20",
  CANCELLED: "bg-slate-100 text-slate-500 ring-slate-400/20",
};

const TABS: { key: "ALL" | CampaignStatus; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "DRAFT", label: "Drafts" },
  { key: "SCHEDULED", label: "Scheduled" },
  { key: "RUNNING", label: "Running" },
  { key: "COMPLETED", label: "Completed" },
  { key: "PAUSED", label: "Paused" },
  { key: "FAILED", label: "Failed" },
];




// ─── Hooks ────────────────────────────────────────────────────────────────────

function useCampaigns(status: "ALL" | CampaignStatus) {
  return useQuery<Campaign[]>({
    queryKey: ["campaigns", status],
    queryFn: async () => {
      const qs = status === "ALL" ? "" : `?status=${status}`;
      const res = await fetch(`/api/campaigns${qs}`);
      if (!res.ok) throw new Error(`Failed to load campaigns (${res.status})`);
      const json = await res.json();
      return Array.isArray(json) ? json : (json.data ?? []);
    },
    retry: false,
  });
}

function RateBar({ value, total }: { value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="min-w-24">
      <div className="flex items-center justify-between gap-2 text-xs text-slate-600">
        <span className="tabular-nums">{formatCompact(value)}</span>
        <span className="tabular-nums text-slate-400">{pct}%</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn(
            "h-full rounded-full",
            pct >= 80 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-rose-500",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CampaignsPage() {
  return (
    <Suspense>
      <CampaignsPageInner />
    </Suspense>
  );
}

function CampaignsPageInner() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  useCampaignsRealtime();
  // /campaigns?segment=<id> was how Segments opened the create dialog. The dialog is a
  // page now, so the old link is forwarded rather than quietly doing nothing.
  const initialSegmentId = useSearchParams().get("segment");
  const router = useRouter();
  useEffect(() => {
    if (initialSegmentId) router.replace(`/campaigns/new?segment=${initialSegmentId}`);
  }, [initialSegmentId, router]);
  const [tab, setTab] = useState<"ALL" | CampaignStatus>("ALL");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useCampaigns(tab);
  const campaigns = useMemo(() => data ?? [], [data]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["campaigns"] });

  // ── Mutations ──

  /**
   * Start, pause or pick up a campaign.
   *
   * Each is its own endpoint because each does different work: launching queues the
   * recipients and drops anyone who has opted out since the list was built, pausing stops
   * the workers mid-run, and resuming queues only what is still pending. This used to
   * PATCH a status field the server ignores, so neither button did anything.
   */
  const toggleMutation = useMutation({
    mutationFn: async ({ id, current }: { id: string; current: CampaignStatus }) => {
      const action = current === "RUNNING" ? "pause"
        : current === "PAUSED" ? "resume"
        : "launch";
      const res = await fetch(`/api/campaigns/${id}/${action}`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((json as { error?: string }).error ?? `Couldn't ${action} the campaign`);
      }
      return json;
    },
    onSuccess: () => invalidate(),
    onError: (err: Error) => showToast(err.message, "error"),
  });

  const duplicateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/campaigns/${id}/duplicate`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to duplicate");
      }
      return res.json();
    },
    onSuccess: () => invalidate(),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to delete campaign");
      }
      return res.json();
    },
    onSuccess: () => { invalidate(); setDeletingId(null); },
  });

  // Per-row pending helpers
  const isToggling = (id: string) =>
    toggleMutation.isPending && (toggleMutation.variables as { id: string } | undefined)?.id === id;
  const isDuplicating = (id: string) =>
    duplicateMutation.isPending && duplicateMutation.variables === id;

  // Row actions are shared by the desktop table and the phone card list.
  const renderActions = (c: Campaign) => {
    const toggling = isToggling(c.id);
    const duplicating = isDuplicating(c.id);
    return (
    <>
      <Link href={`/campaigns/${c.id}`}>
        <Button variant="ghost" size="sm" aria-label="View campaign report">
          <Eye className="h-4 w-4" />
        </Button>
      </Link>
      <Button
        variant="ghost"
        size="sm"
        aria-label={
          c.status === "RUNNING" ? "Pause campaign"
            : c.status === "PAUSED" ? "Resume campaign"
            : "Launch campaign"
        }
        onClick={() => toggleMutation.mutate({ id: c.id, current: c.status })}
        disabled={toggling || c.status === "COMPLETED" || c.status === "FAILED" || c.status === "CANCELLED"}
      >
        {toggling ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : c.status === "RUNNING" ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        aria-label="Duplicate campaign"
        onClick={() => duplicateMutation.mutate(c.id)}
        disabled={duplicating}
      >
        {duplicating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        aria-label="Delete campaign"
        className="text-rose-600 hover:bg-rose-50"
        onClick={() => setDeletingId(c.id)}
        disabled={c.status === "RUNNING"}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </>
    );
  };

  return (
    <div>
      <PageHeader
        title="Campaigns"
        description="Broadcast WhatsApp templates to a segment and track delivery in real time."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ExportButton resource="campaigns" />
            <Link
              href="/campaigns/new"
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--brand-600,#059669)] px-3.5 text-sm font-medium text-white shadow-sm transition hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              New campaign
            </Link>
          </div>
        }
      />

      {/* Status filter tabs */}
      <div className="scrollbar-slim mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition",
              tab === t.key
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-800",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-4">
            <SkeletonRows rows={6} />
          </div>
        ) : isError || campaigns.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title={isError ? "Couldn't load campaigns" : "No campaigns yet"}
            description={
              isError
                ? (error as Error)?.message ?? "Something went wrong fetching them. Try again in a moment."
                : "Create your first broadcast to reach contacts on WhatsApp using an approved message template."
            }
            action={
              <Link
                href="/campaigns/new"
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--brand-600,#059669)] px-3.5 text-sm font-medium text-white shadow-sm transition hover:opacity-90"
              >
                <Plus className="h-4 w-4" />
                New campaign
              </Link>
            }
          />
        ) : (
          <>
          {/* Phones: stacked cards instead of the 11-column table */}
          <ul className="divide-y divide-slate-100 md:hidden">
            {campaigns.map((c) => (
              <li key={c.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{c.name}</p>
                    {c.scheduledAt ? (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                        <CalendarClock className="h-3 w-3" />
                        {formatDate(c.scheduledAt)}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-xs text-slate-500">{formatDate(c.createdAt)}</p>
                    )}
                  </div>
                  <Badge className={STATUS_STYLE[c.status]}>{c.status}</Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
                  {(
                    [
                      ["Sent", c.sentCount],
                      ["Delivered", c.deliveredCount ?? 0],
                      ["Read", c.readCount ?? 0],
                      ["Clicked", c.clickedCount ?? 0],
                    ] as [string, number][]
                  ).map(([label, value]) => (
                    <div key={label}>
                      <p className="mb-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
                      <RateBar value={value} total={c.totalCount} />
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <p className="text-xs text-slate-500">
                    <span className="tabular-nums text-slate-700">{formatCompact(c.totalCount)}</span> recipients ·{" "}
                    <span className="tabular-nums">{formatCompact(c.repliedCount ?? 0)}</span> replied ·{" "}
                    <span className="tabular-nums text-rose-600">{formatCompact(c.failedCount)}</span> failed
                  </p>
                  <div className="flex shrink-0 items-center gap-1 [&>button]:h-10 [&>button]:w-10">
                    {renderActions(c)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="scrollbar-slim hidden overflow-x-auto md:block">
            <table className="w-full min-w-5xl text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Campaign</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Recipients</th>
                  <th className="px-4 py-3 font-medium">Sent</th>
                  <th className="px-4 py-3 font-medium">Delivered</th>
                  <th className="px-4 py-3 font-medium">Read</th>
                  <th className="px-4 py-3 font-medium">Clicked</th>
                  <th className="px-4 py-3 font-medium">Replied</th>
                  <th className="px-4 py-3 font-medium">Failed</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {campaigns.map((c) => {
                  return (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="flex items-center gap-1.5 font-medium text-slate-900">
                          {c.name}
                        </p>
                        {c.scheduledAt && (
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                            <CalendarClock className="h-3 w-3" />
                            {formatDate(c.scheduledAt)}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={STATUS_STYLE[c.status]}>{c.status}</Badge>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-700">
                        {formatCompact(c.totalCount)}
                      </td>
                      <td className="px-4 py-3">
                        <RateBar value={c.sentCount} total={c.totalCount} />
                      </td>
                      <td className="px-4 py-3">
                        <RateBar value={c.deliveredCount ?? 0} total={c.totalCount} />
                      </td>
                      <td className="px-4 py-3">
                        <RateBar value={c.readCount ?? 0} total={c.totalCount} />
                      </td>
                      <td className="px-4 py-3">
                        <RateBar value={c.clickedCount ?? 0} total={c.totalCount} />
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-700">
                        {formatCompact(c.repliedCount ?? 0)}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-rose-600">
                        {formatCompact(c.failedCount)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                        {formatDate(c.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">{renderActions(c)}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </Card>

      {/* Delete confirmation — proper modal, not browser confirm() */}
      <Modal
        open={!!deletingId}
        onClose={() => !deleteMutation.isPending && setDeletingId(null)}
        title="Delete campaign?"
        description="This permanently removes the campaign and all its recipient records. This cannot be undone."
      >
        {deleteMutation.isError && (
          <p className="mb-3 flex items-center gap-1.5 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {(deleteMutation.error as Error).message}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end [&>button]:h-10 [&>button]:w-full sm:[&>button]:h-9 sm:[&>button]:w-auto pt-2">
          <Button
            variant="secondary"
            onClick={() => setDeletingId(null)}
            disabled={deleteMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={deleteMutation.isPending}
            onClick={() => deletingId && deleteMutation.mutate(deletingId)}
          >
            {deleteMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Deleting…
              </>
            ) : (
              "Delete campaign"
            )}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// ─── Create Campaign Modal ─────────────────────────────────────────────────────
