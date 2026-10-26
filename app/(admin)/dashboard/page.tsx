"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Database,
  IndianRupee,
  MessageSquare,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
  Webhook,
  WifiOff,
} from "lucide-react";
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Avatar } from "@/components/ui";
import {
  AdminBadge,
  AdminEmptyState,
  AdminPageHeader,
  AdminPanel,
  AdminSkeleton,
  AdminSkeletonRows,
  AdminTable,
  CHART,
  StatTile,
  axisProps,
  planTone,
  tdClass,
  thClass,
  tooltipStyle,
} from "@/components/admin/ui";
import { formatCompact, formatCurrency, formatDate } from "@/lib/utils";

// ─── Types + data ─────────────────────────────────────────────────────────────

interface RecentTenant {
  id: string;
  name: string;
  slug: string;
  plan?: string | null;
  users?: number;
  createdAt: string;
}

interface AdminStats {
  totalTenants: number;
  activeTenants: number;
  totalUsers: number;
  totalMessages: number;
  mrr: number;
  arr?: number;
  signupsThisMonth: number;
  churnRate: number;
  signupsLast30Days: { date: string; count: number }[];
  planBreakdown: { planName: string; count: number }[];
  recentTenants: RecentTenant[];
}

interface HealthData {
  api: { latencyMs: number; status: string };
  database: { latencyMs: number; status: string };
  realtime: { configured: boolean; status: string };
  whatsapp: { configured: boolean; status: string };
  checkedAt: string;
}

function useAdminHealth() {
  return useQuery<HealthData>({
    queryKey: ["admin", "health"],
    queryFn: async () => {
      const res = await fetch("/api/admin/health");
      if (!res.ok) throw new Error("Failed to load health");
      const json = await res.json();
      return (json.data ?? json) as HealthData;
    },
    refetchInterval: 60_000,
    retry: false,
  });
}

function useAdminStats() {
  return useQuery<AdminStats>({
    queryKey: ["admin", "stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stats");
      if (!res.ok) throw new Error(`Failed to load stats (${res.status})`);
      const json = await res.json();
      return (json.data ?? json) as AdminStats;
    },
    retry: false,
  });
}

const EMPTY_STATS: AdminStats = {
  totalTenants: 0, activeTenants: 0, totalUsers: 0, totalMessages: 0,
  mrr: 0, signupsThisMonth: 0, churnRate: 0,
  signupsLast30Days: [], planBreakdown: [], recentTenants: [],
};

const PIE_COLORS = [CHART.sky, CHART.violet, CHART.amber];

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const { data, isLoading, isError } = useAdminStats();
  const { data: health, isLoading: healthLoading } = useAdminHealth();

  const stats = data ?? EMPTY_STATS;
  const preview = isError && !data;
  const arr = stats.arr ?? stats.mrr * 12;
  const signups = stats.signupsLast30Days ?? [];
  const plans = stats.planBreakdown ?? [];
  const recent = (stats.recentTenants ?? []).slice(0, 5);

  return (
    <>
      <AdminPageHeader
        title="Platform Overview"
        description="Real-time stats across every workspace on Corescent."
        action={
          <AdminBadge tone={isError ? "rose" : isLoading ? "amber" : "emerald"}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {isError ? "Stats unavailable" : isLoading ? "Loading…" : "Live"}
          </AdminBadge>
        }
      />

      {preview && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Could not load platform stats. Check the backend connection.
        </div>
      )}

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile
          label="Total Customers"
          value={formatCompact(stats.totalTenants)}
          icon={Building2}
          tone="violet"
          loading={isLoading}
        />
        <StatTile
          label="Active Customers"
          value={formatCompact(stats.activeTenants)}
          icon={CheckCircle2}
          tone="emerald"
          delta={stats.totalTenants ? `${Math.round((stats.activeTenants / stats.totalTenants) * 100)}%` : undefined}
          deltaDirection="flat"
          deltaNote="of all workspaces"
          loading={isLoading}
        />
        <StatTile
          label="MRR"
          value={formatCurrency(stats.mrr)}
          icon={IndianRupee}
          tone="sky"
          loading={isLoading}
        />
        <StatTile
          label="ARR"
          value={formatCurrency(arr)}
          icon={CircleDollarSign}
          tone="amber"
          deltaNote="annualised run-rate"
          loading={isLoading}
        />
        <StatTile
          label="Total Users"
          value={formatCompact(stats.totalUsers)}
          icon={Users}
          tone="violet"
          deltaNote="across all workspaces"
          loading={isLoading}
        />
        <StatTile
          label="Messages (30d)"
          value={formatCompact(stats.totalMessages)}
          icon={MessageSquare}
          tone="emerald"
          deltaNote="inbound + outbound"
          loading={isLoading}
        />
        <StatTile
          label="Signups This Month"
          value={formatCompact(stats.signupsThisMonth)}
          icon={UserPlus}
          tone="sky"
          loading={isLoading}
        />
        <StatTile
          label="Churn Rate"
          value={`${(stats.churnRate ?? 0).toFixed(1)}%`}
          icon={TrendingDown}
          tone="rose"
          deltaNote="lower is better"
          loading={isLoading}
        />
      </div>

      {/* Charts */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <AdminPanel
          title="Signups — last 30 days"
          subtitle="New workspaces per day"
          className="lg:col-span-2"
          action={<TrendingUp className="h-4 w-4 text-[#0B6E4F]" />}
        >
          <div className="h-56 sm:h-64">
            {isLoading ? (
              <AdminSkeleton className="h-full w-full" />
            ) : signups.length === 0 ? (
              <AdminEmptyState icon={TrendingUp} title="No signup data" description="Nothing to chart yet." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={signups} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={shortDate} interval={4} {...axisProps} />
                  <YAxis allowDecimals={false} {...axisProps} />
                  <Tooltip
                    {...tooltipStyle}
                    labelFormatter={(v) => shortDate(String(v))}
                    formatter={(v) => [`${Number(v)} signups`, ""]}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke={CHART.violet}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: CHART.violet }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </AdminPanel>

        <AdminPanel title="Plan Distribution" subtitle="Tenants per plan">
          <div className="h-56 sm:h-64">
            {isLoading ? (
              <AdminSkeleton className="h-full w-full" />
            ) : plans.length === 0 ? (
              <AdminEmptyState icon={CircleDollarSign} title="No plan data" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={plans}
                    dataKey="count"
                    nameKey="planName"
                    innerRadius={52}
                    outerRadius={82}
                    paddingAngle={2}
                    stroke="#ffffff"
                    strokeWidth={2}
                  >
                    {plans.map((p, i) => (
                      <Cell key={p.planName} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip {...tooltipStyle} formatter={(v, n) => [`${Number(v)} tenants`, String(n)]} />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    formatter={(value) => <span className="text-xs text-slate-500">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </AdminPanel>
      </div>

      {/* Recent tenants + system health */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <AdminPanel
          title="Recent Tenants"
          subtitle="Last 5 signups"
          className="lg:col-span-2"
          bodyClassName="p-0"
          action={
            <Link href="/tenants" className="text-xs font-medium text-[#0B6E4F] hover:text-[#095c42]">
              View all
            </Link>
          }
        >
          {isLoading ? (
            <div className="p-5">
              <AdminSkeletonRows rows={5} />
            </div>
          ) : recent.length === 0 ? (
            <AdminEmptyState
              icon={Building2}
              title="No tenants yet"
              description="New workspaces will appear here as they sign up."
            />
          ) : (
            <AdminTable>
              <thead className="border-b border-slate-200 bg-[#FAFAFA]">
                <tr>
                  <th className={thClass}>Workspace</th>
                  <th className={thClass}>Plan</th>
                  <th className={thClass}>Users</th>
                  <th className={thClass}>Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {recent.map((t) => (
                  <tr key={t.id} className="transition hover:bg-slate-50">
                    <td className={tdClass}>
                      <div className="flex items-center gap-3">
                        <Avatar name={t.name} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900">{t.name}</p>
                          <p className="truncate text-xs text-slate-500">/{t.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className={tdClass}>
                      <AdminBadge tone={planTone(t.plan)}>{t.plan ?? "—"}</AdminBadge>
                    </td>
                    <td className={tdClass}>{t.users ?? 0}</td>
                    <td className={tdClass}>
                      <span className="text-slate-500">{formatDate(t.createdAt)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </AdminTable>
          )}
        </AdminPanel>

        <AdminPanel title="System Health" subtitle="Live probe — auto-refresh every 60s">
          {healthLoading ? (
            <AdminSkeleton className="h-32 w-full" />
          ) : !health ? (
            <AdminEmptyState icon={WifiOff} title="Health check unavailable" description="Could not reach /api/admin/health." />
          ) : (
            <ul className="space-y-3">
              <HealthRow
                icon={Activity}
                label="API latency"
                value={`${health.api.latencyMs} ms`}
                tone={health.api.latencyMs < 300 ? "emerald" : health.api.latencyMs < 1000 ? "amber" : "rose"}
                chip={health.api.status === "healthy" ? "Healthy" : "Degraded"}
              />
              <HealthRow
                icon={Database}
                label="Database"
                value={`Neon · ${health.database.latencyMs} ms`}
                tone={health.database.status === "online" ? "emerald" : "rose"}
                chip={health.database.status === "online" ? "Online" : "Error"}
              />
              <HealthRow
                icon={Webhook}
                label="SSE realtime"
                value={health.realtime.configured ? "Configured" : "Not configured"}
                tone={health.realtime.configured ? "emerald" : "amber"}
                chip={health.realtime.configured ? "Active" : "Missing"}
              />
              <HealthRow
                icon={MessageSquare}
                label="WhatsApp Cloud API"
                value={health.whatsapp.configured ? "App secret set" : "Not configured"}
                tone={health.whatsapp.configured ? "emerald" : "amber"}
                chip={health.whatsapp.configured ? "Configured" : "Missing"}
              />
            </ul>
          )}
          <p className="mt-4 border-t border-slate-200 pt-3 text-xs text-slate-400">
            Last checked: {health ? new Date(health.checkedAt).toLocaleTimeString() : "—"} · auto-refresh every 60s
          </p>
        </AdminPanel>
      </div>
    </>
  );
}

function HealthRow({
  icon: Icon,
  label,
  value,
  tone,
  chip,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: "emerald" | "amber" | "rose";
  chip: string;
}) {
  return (
    <li className="flex items-center gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-slate-900">{label}</p>
        <p className="truncate text-xs text-slate-500">{value}</p>
      </div>
      <AdminBadge tone={tone}>{chip}</AdminBadge>
    </li>
  );
}