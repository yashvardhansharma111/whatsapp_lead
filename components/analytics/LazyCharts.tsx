"use client";

// The charting library is the heaviest thing this app depends on, and every one of these
// components pulls it in. Loading them on demand keeps it out of the first download for
// the pages that merely link to a report, and off the critical path for the one that
// shows it — the figures above the charts render while this arrives.
//
// Each falls back to a placeholder the size of the chart it replaces, so the page does not
// jump when it lands. They are client-only: the library measures its container, which it
// cannot do while rendering on the server.

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui";

const panel = (height: string) =>
  function ChartLoading() {
    return (
      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5" role="status" aria-label="Loading chart">
        <Skeleton className="h-4 w-40" />
        <Skeleton className={`mt-4 w-full rounded-lg ${height}`} />
      </div>
    );
  };

export const MessagesOverTimeChart = dynamic(
  () => import("./Charts").then((m) => m.MessagesOverTimeChart),
  { ssr: false, loading: panel("h-64") },
);

export const LeadPipelineChart = dynamic(
  () => import("./Charts").then((m) => m.LeadPipelineChart),
  { ssr: false, loading: panel("h-64") },
);

export const LeadScoreDonut = dynamic(
  () => import("./Charts").then((m) => m.LeadScoreDonut),
  { ssr: false, loading: panel("h-56") },
);

export const CampaignPerformanceChart = dynamic(
  () => import("./Charts").then((m) => m.CampaignPerformanceChart),
  { ssr: false, loading: panel("h-64") },
);

export const AgentPerformanceTable = dynamic(
  () => import("./Charts").then((m) => m.AgentPerformanceTable),
  { ssr: false, loading: panel("h-48") },
);
