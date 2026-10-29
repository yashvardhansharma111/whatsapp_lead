"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, MessageSquare, Sparkles } from "lucide-react";
import type { PipelineLead } from "./LeadCard";
import { cn, timeAgo } from "@/lib/utils";

const CRITERION_LABELS: Record<string, string> = {
  budget: "Budget", authority: "Authority", need: "Need",
  timeline: "Timeline", engagement: "Engagement",
};

/**
 * What the model concluded about a lead, and how it got there.
 *
 * The breakdown is the point. A score with no explanation is a number somebody has to
 * take on trust, and the first thing a salesperson asks of one is why. Each criterion
 * shows what the model rated it and what that was worth once the workspace's weights
 * were applied, which together are the whole arithmetic.
 */
export function AiVerdictPanel({ lead }: { lead: PipelineLead }) {
  const [openBreakdown, setOpenBreakdown] = useState(false);

  if (!lead.aiQualifiedAt) return null;

  const scores = lead.aiBreakdown?.scores ?? {};
  const weights = lead.aiBreakdown?.weights ?? {};
  const criteria = Object.keys(scores);
  const score = lead.aiScore ?? lead.score ?? 0;

  return (
    <section className="rounded-xl border border-violet-200 bg-violet-50/50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles className="h-4 w-4 shrink-0 text-violet-600" />
        <p className="text-xs font-semibold text-violet-900">Scored by AI</p>
        <span className="text-[11px] text-violet-700">{timeAgo(lead.aiQualifiedAt)}</span>
        {lead.aiConfidence != null && (
          <span
            className={cn(
              "ml-auto rounded px-1.5 py-0.5 text-[11px] font-medium",
              lead.aiConfidence >= 70 ? "bg-violet-100 text-violet-800" : "bg-amber-100 text-amber-800",
            )}
            title="How sure the model was about its own reading"
          >
            {lead.aiConfidence}% sure
          </span>
        )}
      </div>

      {lead.aiConfidence != null && lead.aiConfidence < 50 && (
        <p className="mt-2 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
          The model was not confident here. Worth reading the thread yourself.
        </p>
      )}

      {lead.aiSummary && (
        <p className="mt-2 text-sm leading-relaxed text-slate-700">{lead.aiSummary}</p>
      )}

      {lead.aiIntent && (
        <p className="mt-2 text-xs text-slate-600">
          <span className="font-medium text-slate-700">They want:</span> {lead.aiIntent}
        </p>
      )}

      {lead.aiNextStep && (
        <p className="mt-2 rounded-md bg-white px-2.5 py-2 text-xs text-slate-700 ring-1 ring-violet-100">
          <span className="font-medium text-violet-800">Next step:</span> {lead.aiNextStep}
        </p>
      )}

      {criteria.length > 0 && (
        <div className="mt-2.5">
          <button
            type="button"
            onClick={() => setOpenBreakdown((v) => !v)}
            aria-expanded={openBreakdown}
            className="flex w-full items-center gap-1 text-[11px] font-medium text-violet-700 transition hover:text-violet-900"
          >
            <ChevronDown className={cn("h-3 w-3 transition", openBreakdown && "rotate-180")} />
            How the {score} was reached
          </button>

          {openBreakdown && (
            <ul className="mt-2 space-y-2">
              {criteria.map((k) => {
                const rated = scores[k] ?? 0;
                const weight = weights[k] ?? 0;
                // What this criterion actually contributed to the final score.
                const contributed = Math.round((rated * weight) / 100);
                return (
                  <li key={k}>
                    <div className="flex items-baseline justify-between gap-2 text-[11px]">
                      <span className="font-medium text-slate-700">{CRITERION_LABELS[k] ?? k}</span>
                      <span className="tabular-nums text-slate-500">
                        rated {rated} · worth {Math.round(weight)}% · adds {contributed}
                      </span>
                    </div>
                    <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-violet-100">
                      <div className="h-full rounded-full bg-violet-500" style={{ width: `${rated}%` }} />
                    </div>
                  </li>
                );
              })}
              <li className="flex items-baseline justify-between border-t border-violet-200 pt-1.5 text-[11px] font-semibold text-slate-800">
                <span>Total</span>
                <span className="tabular-nums">{score} out of 100</span>
              </li>
            </ul>
          )}
        </div>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-3 border-t border-violet-200 pt-2">
        {lead.aiConversationId && (
          <Link
            href={`/inbox?c=${lead.aiConversationId}`}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-violet-700 hover:underline"
          >
            <MessageSquare className="h-3 w-3" />
            The conversation it read
          </Link>
        )}
        {lead.aiModel && (
          <span className="truncate text-[11px] text-slate-400" title={lead.aiModel}>{lead.aiModel}</span>
        )}
      </div>
    </section>
  );
}
