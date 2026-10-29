"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Ban, Clock, PauseCircle, Play, ShieldOff } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

/** What the server decided to do about an error code, used to word the row. */
type ErrorAction = "RETRY" | "DROP" | "SUPPRESS" | "ABORT";

interface FailureBreakdown {
  status: string;
  haltedAt: string | null;
  haltReason: string | null;
  haltErrorCode: number | null;
  skippedCount: number;
  failedCount: number;
  reasons: {
    errorCode: number | null;
    title: string | null;
    reason: string;
    count: number;
    action: ErrorAction;
  }[];
}

const ACTION_NOTE: Record<ErrorAction, { label: string; icon: typeof Ban; tone: string }> = {
  SUPPRESS: { label: "Will not be messaged again", icon: ShieldOff,     tone: "text-violet-700 bg-violet-50" },
  DROP:     { label: "Not retried",                icon: Ban,           tone: "text-slate-600 bg-slate-100" },
  RETRY:    { label: "Retried automatically",      icon: Clock,         tone: "text-sky-700 bg-sky-50" },
  ABORT:    { label: "Stopped the campaign",       icon: AlertTriangle, tone: "text-rose-700 bg-rose-50" },
};

/**
 * Why a campaign stopped, and what it ran into.
 *
 * A run can fail for one reason or twenty, and the difference matters: a handful of
 * numbers that are not on WhatsApp is normal, while every recipient failing on the same
 * code means something is wrong with the account or the template. Grouping by code makes
 * that visible instead of leaving someone to scroll a list of identical rows.
 */
export function CampaignHaltNotice({ campaignId, status }: { campaignId: string; status: string }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [resuming, setResuming] = useState(false);

  const { data } = useQuery<FailureBreakdown>({
    queryKey: ["campaign-failures", campaignId],
    queryFn: async () => {
      const res = await fetch(`/api/campaigns/${campaignId}/failures`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error ?? "Couldn't load the failures");
      return (json.data ?? json) as FailureBreakdown;
    },
    enabled: Boolean(campaignId),
  });

  async function resume() {
    setResuming(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/resume`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error ?? "Couldn't resume the campaign");
      const enqueued = (json.data ?? json).enqueued ?? 0;
      showToast(`Resumed. ${enqueued.toLocaleString()} still to send.`, "success");
      await queryClient.invalidateQueries({ queryKey: ["campaign", campaignId] });
      await queryClient.invalidateQueries({ queryKey: ["campaign-failures", campaignId] });
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Couldn't resume the campaign", "error");
    } finally {
      setResuming(false);
    }
  }

  const paused = status === "PAUSED";
  const reasons = data?.reasons ?? [];
  if (!paused && reasons.length === 0) return null;

  return (
    <div className="mb-5 space-y-3">
      {paused && (
        <Card className="border-amber-200 bg-amber-50/70 p-4">
          <div className="flex flex-wrap items-start gap-3">
            <PauseCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-amber-900">
                {data?.haltErrorCode ? "WhatsApp stopped this campaign" : "This campaign is paused"}
              </p>
              <p className="mt-0.5 text-sm leading-relaxed text-amber-800">
                {data?.haltReason ?? "It is not sending. Resume it when you are ready."}
              </p>
              {data?.haltErrorCode != null && (
                <p className="mt-1.5 text-xs text-amber-700">
                  Fix the cause first. Resuming before then will stop it again on the next message.
                </p>
              )}
            </div>
            <Button size="sm" onClick={resume} disabled={resuming} className="shrink-0">
              <Play className="h-3.5 w-3.5" />
              {resuming ? "Resuming…" : "Resume"}
            </Button>
          </div>
        </Card>
      )}

      {reasons.length > 0 && (
        <Card className="overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3">
            <p className="text-sm font-medium text-slate-700">Why messages did not arrive</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Grouped by what WhatsApp reported. The code is worth quoting if you contact support.
            </p>
          </div>
          <ul className="divide-y divide-slate-100">
            {reasons.map((r) => {
              const note = ACTION_NOTE[r.action] ?? ACTION_NOTE.DROP;
              const Icon = note.icon;
              return (
                <li key={r.errorCode ?? "unknown"} className="flex flex-wrap items-start gap-3 px-4 py-3">
                  <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold tabular-nums text-slate-700">
                    {r.count.toLocaleString()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-relaxed text-slate-800">{r.reason}</p>
                    <span className={cn(
                      "mt-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium",
                      note.tone,
                    )}>
                      <Icon className="h-3 w-3" />
                      {note.label}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
          {(data?.skippedCount ?? 0) > 0 && (
            <p className="border-t border-slate-100 bg-slate-50/70 px-4 py-2.5 text-xs text-slate-600">
              {data!.skippedCount.toLocaleString()} recipient
              {data!.skippedCount === 1 ? " was" : "s were"} passed over on purpose, because they had
              turned off marketing messages or were already at WhatsApp&apos;s limit for the day. They
              are not counted as failures.
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
