"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Ban, Clock, ExternalLink, PauseCircle, Play, ShieldOff } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { errorHelp } from "@/lib/campaigns/errorHelp";

/** What the server decided to do about an error code, used to word the row. */
type ErrorAction = "RETRY" | "DROP" | "SUPPRESS" | "ABORT";

interface FailureBreakdown {
  status: string;
  haltedAt: string | null;
  haltReason: string | null;
  haltErrorCode: number | null;
  skippedCount: number;
  failedCount: number;
  sentCount: number;
  totalCount: number;
  reasons: {
    errorCode: number | null;
    title: string | null;
    reason: string;
    /** WhatsApp's own sentence, when it sent one. */
    detail: string | null;
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

  // The error that stopped it. Taken from the halt when there is one, and otherwise from
  // the failures themselves — campaigns that ran before the halt existed still carry the
  // code, and the explanation is just as useful to them.
  const abort = reasons.find((r) => r.action === "ABORT") ?? null;
  const stopCode = data?.haltErrorCode ?? abort?.errorCode ?? null;
  const help = errorHelp(stopCode);

  // A campaign WhatsApp stopped is not always resumable. When nothing got through it ends
  // as FAILED with nobody left to send to, and the notice still has to appear — showing
  // it only for PAUSED left the worst case explaining itself the least.
  const stopped = paused || Boolean(data?.haltedAt) || status === "FAILED" || Boolean(abort);
  // Only say "nothing was sent" when that is true. A campaign that delivered most of its
  // list and hit one bad error at the end did not fail, and should not be told it did.
  const sentNothing = (data?.sentCount ?? 0) === 0;
  // A recipient's recorded reason ends with "(WhatsApp error 131042)". The code is stated
  // once below, on its own line, so it is dropped here rather than said twice in a row.
  const stopReason = (data?.haltReason ?? abort?.reason ?? "")
    .replace(/\s*\(WhatsApp error \d+\)\s*$/, "");

  if (!stopped && reasons.length === 0) return null;

  // Amber reads as "held, pick it back up"; rose as "this one is over". The two states
  // want different things from the reader, so they should not look alike.
  const tone = paused
    ? { card: "border-amber-200 bg-amber-50/70", icon: "text-amber-600", head: "text-amber-900", body: "text-amber-800", note: "text-amber-700" }
    : { card: "border-rose-200 bg-rose-50/70",  icon: "text-rose-600",  head: "text-rose-900",  body: "text-rose-800",  note: "text-rose-700" };
  const Icon = paused ? PauseCircle : AlertTriangle;

  return (
    <div className="mb-5 space-y-3">
      {stopped && (
        <Card className={cn("p-4", tone.card)}>
          <div className="flex flex-wrap items-start gap-3">
            <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", tone.icon)} />
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm font-semibold", tone.head)}>
                {stopCode == null
                  ? paused ? "This campaign is paused" : "This campaign did not finish"
                  : paused
                    ? "WhatsApp stopped this campaign"
                    : sentNothing
                      ? "WhatsApp stopped this campaign — nothing was sent"
                      : "WhatsApp stopped this campaign before it finished"}
              </p>
              <p className={cn("mt-0.5 text-sm leading-relaxed", tone.body)}>
                {stopReason || "It is not sending. Resume it when you are ready."}
              </p>

              {/* What to do about it, and where. The sentence above says what broke; on its
                  own it does not say whose account it is, which for billing is the whole
                  question. */}
              {help && (
                <div className={cn("mt-2 text-sm leading-relaxed", tone.body)}>
                  <p>{help.action}</p>
                  {help.href && (
                    help.external ? (
                      <a
                        href={help.href}
                        target="_blank"
                        rel="noreferrer"
                        className={cn("mt-1.5 inline-flex items-center gap-1 text-sm font-medium underline underline-offset-2", tone.head)}
                      >
                        {help.hrefLabel}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <Link
                        href={help.href}
                        className={cn("mt-1.5 inline-flex items-center gap-1 text-sm font-medium underline underline-offset-2", tone.head)}
                      >
                        {help.hrefLabel}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    )
                  )}
                </div>
              )}

              {stopCode != null && (
                <p className={cn("mt-2 text-xs", tone.note)}>
                  {paused
                    ? "Fix the cause first. Resuming before then will stop it again on the next message."
                    : "Fix the cause first, then send this campaign again."}
                  {" "}WhatsApp error {stopCode}.
                </p>
              )}
            </div>

            {/* Only offered when there is something left to send — a campaign that ends
                FAILED has nobody pending, and a Resume button there does nothing. */}
            {paused && (
              <Button size="sm" onClick={resume} disabled={resuming} className="shrink-0">
                <Play className="h-3.5 w-3.5" />
                {resuming ? "Resuming…" : "Resume"}
              </Button>
            )}
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
                    {/* Meta's own words, marked as theirs. Support asks to see exactly
                        what WhatsApp said, and our paraphrase is not that. */}
                    {r.detail && (
                      <p className="mt-1 border-l-2 border-slate-200 pl-2 text-xs italic leading-relaxed text-slate-500">
                        WhatsApp&apos;s words: &ldquo;{r.detail}&rdquo;
                      </p>
                    )}
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
