"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Download,
  MessageSquare,
  Users,
  Megaphone,
  UserCog,
  Target,
  Loader2,
  TrendingUp,
  CalendarDays,
} from "lucide-react";
import { Button, Card, PageHeader } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { cn, formatCompact } from "@/lib/utils";
import type { AnalyticsData } from "@/components/analytics/Charts";

// ─── Period ───────────────────────────────────────────────────────────────────

const PERIODS = [
  { value: "today", label: "Today" },
  { value: "7d",    label: "7 days" },
  { value: "30d",   label: "30 days" },
  { value: "90d",   label: "90 days" },
] as const;
type Period = (typeof PERIODS)[number]["value"];

// ─── Role helpers ─────────────────────────────────────────────────────────────

const ADMIN_ROLES  = ["SUPER_ADMIN", "TENANT_OWNER", "ADMIN", "MANAGER", "MARKETING_USER"];
const MANAGER_ROLES = ["SUPER_ADMIN", "TENANT_OWNER", "ADMIN", "MANAGER"];

// ─── Data ─────────────────────────────────────────────────────────────────────

function useAnalyticsSummary(period: Period) {
  return useQuery<AnalyticsData>({
    queryKey: ["analytics", period],
    queryFn: async () => {
      const res = await fetch(`/api/analytics?period=${period}`);
      if (!res.ok) throw new Error("Failed");
      const json: unknown = await res.json();
      if (json && typeof json === "object" && "data" in json) {
        return (json as { data: AnalyticsData }).data ?? {};
      }
      return json as AnalyticsData;
    },
    staleTime: 60_000,
  });
}

// ─── Download helper ──────────────────────────────────────────────────────────

async function triggerDownload(resource: string, period: Period): Promise<void> {
  const res = await fetch(`/api/export?resource=${resource}&period=${period}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Export failed (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${resource}-${period}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Report card ─────────────────────────────────────────────────────────────

interface ReportCardProps {
  resource: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  count?: number | null;
  period: Period;
  columns: string;
}

function ReportCard({ resource, icon: Icon, title, description, count, period, columns }: ReportCardProps) {
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  async function handleDownload() {
    setLoading(true);
    try {
      await triggerDownload(resource, period);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Export failed", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
          <Icon className="h-5 w-5 text-emerald-600" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">{description}</p>
        </div>
        {count != null && (
          <p className="shrink-0 text-2xl font-bold tabular-nums text-slate-900">{formatCompact(count)}</p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <p className="truncate text-xs text-slate-400">
          Columns: <span className="text-slate-500">{columns}</span>
        </p>
        <Button
          size="sm"
          variant="secondary"
          onClick={handleDownload}
          disabled={loading}
          className="shrink-0"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          {loading ? "Downloading…" : "CSV"}
        </Button>
      </div>
    </Card>
  );
}

// ─── Summary strip ────────────────────────────────────────────────────────────

function SummaryStrip({ analytics, period }: { analytics?: AnalyticsData; period: Period }) {
  const metrics = [
    { label: "Messages",      value: analytics?.totalMessages      ?? null },
    { label: "Conversations", value: analytics?.totalConversations ?? null },
    { label: "Leads",         value: analytics?.totalLeads         ?? null },
    { label: "Won deals",     value: analytics?.wonDeals           ?? null },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {metrics.map((m) => (
        <Card key={m.label} className="px-4 py-3">
          <p className="text-xs text-slate-500">{m.label}</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">
            {m.value != null ? formatCompact(m.value) : <span className="text-slate-300">—</span>}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-400 uppercase tracking-wide">{period === "today" ? "today" : period === "7d" ? "last 7 d" : period === "30d" ? "last 30 d" : "last 90 d"}</p>
        </Card>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role ?? "";
  const isAgent = role === "AGENT";

  const [period, setPeriod] = useState<Period>("30d");
  const { data: analytics } = useAnalyticsSummary(period);

  const workspaceCards: ReportCardProps[] = [
    {
      resource:    "conversations",
      icon:        MessageSquare,
      title:       "Conversations",
      description: "All conversations in this period — contact, status, assigned agent, timestamps.",
      count:       analytics?.totalConversations,
      period,
      columns:     "id, contact, phone, status, agent, opened, closed",
    },
    {
      resource:    "contacts",
      icon:        Users,
      title:       "Contacts",
      description: "Full contact list — name, phone, email, source, tags, created date.",
      count:       null,
      period,
      columns:     "id, name, phone, email, company, source, tags, created",
    },
    {
      resource:    "leads",
      icon:        Target,
      title:       "Leads",
      description: "All leads — pipeline stage, score, deal value, BANT fields, close date.",
      count:       analytics?.totalLeads,
      period,
      columns:     "id, contact, stage, value, score, budget, timeline, closed",
    },
    {
      resource:    "campaigns",
      icon:        Megaphone,
      title:       "Campaigns",
      description: "Campaign delivery funnel — sent, delivered, read, failed per campaign.",
      count:       null,
      period,
      columns:     "id, name, template, sent, delivered, read, failed, date",
    },
  ];

  const managerCard: ReportCardProps = {
    resource:    "agents",
    icon:        UserCog,
    title:       "Agent Performance",
    description: "Per-agent breakdown — conversations handled, resolved count, resolution rate.",
    count:       analytics?.agentPerformance?.length ?? null,
    period,
    columns:     "agent, assigned, resolved, rate, avg_resolution_time",
  };

  const myConvCard: ReportCardProps = {
    resource:    "my-conversations",
    icon:        MessageSquare,
    title:       "My Conversations",
    description: "Conversations assigned to you — contact, status, timestamps.",
    count:       null,
    period,
    columns:     "id, contact, phone, status, opened, closed",
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Download workspace data as CSV. Each export is scoped to the selected period."
        action={
          <div className="flex items-center gap-1.5 rounded-lg bg-slate-100 p-1">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition",
                  period === p.value
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700",
                )}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                {p.label}
              </button>
            ))}
          </div>
        }
      />

      {/* Summary strip — only meaningful for admin+ */}
      {ADMIN_ROLES.includes(role) && (
        <SummaryStrip analytics={analytics} period={period} />
      )}

      {/* Export cards */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-slate-400" />
          <p className="text-sm font-medium text-slate-700">Export data</p>
          <span className="text-xs text-slate-400">· max 10,000 rows per file</span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {isAgent ? (
            <ReportCard {...myConvCard} />
          ) : (
            <>
              {workspaceCards.map((card) => (
                <ReportCard key={card.resource} {...card} />
              ))}
              {MANAGER_ROLES.includes(role) && (
                <ReportCard {...managerCard} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
