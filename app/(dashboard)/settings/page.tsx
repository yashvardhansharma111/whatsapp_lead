"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import {
  Building2, MessageSquare, CreditCard, Bell, KanbanSquare,
  UserCircle, Zap, Webhook, DollarSign, BellOff, ScrollText, ChevronRight,
} from "lucide-react";
import { PageHeader } from "@/components/ui";
import { AccountTab } from "@/components/settings/AccountTab";
import { GeneralTab } from "@/components/settings/GeneralTab";
import { WhatsAppTab } from "@/components/settings/WhatsAppTab";
import { BillingTab } from "@/components/settings/BillingTab";
import { NotificationsTab } from "@/components/settings/NotificationsTab";
import { LeadStagesTab } from "@/components/settings/LeadStagesTab";
import { QuickRepliesTab } from "@/components/settings/QuickRepliesTab";
import { WebhooksTab } from "@/components/settings/WebhooksTab";
import { MessageRatesTab } from "@/components/settings/MessageRatesTab";
import { OptOutTab } from "@/components/settings/OptOutTab";
import { ActivityTab } from "@/components/settings/ActivityTab";
import { cn } from "@/lib/utils";

const STAGE_ADMIN_ROLES = ["SUPER_ADMIN", "TENANT_OWNER", "ADMIN"];
const BILLING_ROLES     = ["SUPER_ADMIN", "TENANT_OWNER"];

type TabDef = {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  billingOnly?: boolean;
};

const TAB_GROUPS: { section: string | null; tabs: TabDef[] }[] = [
  {
    section: null,
    tabs: [
      { key: "account",  label: "Account",  icon: UserCircle },
      { key: "general",  label: "General",  icon: Building2 },
    ],
  },
  {
    section: "Channel",
    tabs: [
      { key: "whatsapp",      label: "WhatsApp",      icon: MessageSquare },
      { key: "quick-replies", label: "Quick Replies",  icon: Zap },
      { key: "opt-out",       label: "Opt-out Manager",icon: BellOff,  adminOnly: true },
    ],
  },
  {
    section: "Workspace",
    tabs: [
      { key: "pipeline",      label: "Lead Stages",   icon: KanbanSquare, adminOnly: true },
      { key: "notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    section: "Developer",
    tabs: [
      { key: "webhooks",      label: "Webhooks & API",  icon: Webhook,  adminOnly: true },
      { key: "message-rates", label: "Message Rates",   icon: DollarSign, adminOnly: true },
    ],
  },
  {
    section: "Account",
    tabs: [
      { key: "billing",  label: "Billing",      icon: CreditCard,  billingOnly: true },
      { key: "activity", label: "Activity Log",  icon: ScrollText },
    ],
  },
];

type TabKey = string;

export default function SettingsPage() {
  const { data: session } = useSession();
  const role = session?.user?.role ?? "";
  const isReseller  = session?.user?.accountType === "RESELLER";
  const isStageAdmin = STAGE_ADMIN_ROLES.includes(role);
  const canSeeBilling = BILLING_ROLES.includes(role);

  const [tab, setTab] = useState<TabKey>("account");

  function canSee(t: TabDef): boolean {
    if (isReseller && ["pipeline", "whatsapp", "quick-replies", "notifications"].includes(t.key)) return false;
    if (t.billingOnly) return canSeeBilling;
    if (t.adminOnly)   return isStageAdmin;
    return true;
  }

  const allVisible = TAB_GROUPS.flatMap((g) => g.tabs.filter(canSee));
  const activeTab  = allVisible.some((t) => t.key === tab) ? tab : "account";

  return (
    <div>
      <PageHeader title="Settings" description="Manage your workspace, channel and billing." />

      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8 lg:items-start">
        {/* ── Sidebar nav (desktop) / select (mobile) ── */}
        <aside className="w-full shrink-0 lg:w-52">
          {/* Mobile: compact select */}
          <div className="lg:hidden">
            <select
              value={activeTab}
              onChange={(e) => setTab(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {TAB_GROUPS.map((g) =>
                g.tabs.filter(canSee).length > 0 ? (
                  <optgroup key={g.section ?? "_top"} label={g.section ?? "General"}>
                    {g.tabs.filter(canSee).map((t) => (
                      <option key={t.key} value={t.key}>{t.label}</option>
                    ))}
                  </optgroup>
                ) : null,
              )}
            </select>
          </div>

          {/* Desktop: sidebar */}
          <nav className="hidden lg:block">
            {TAB_GROUPS.map((g, gi) => {
              const visible = g.tabs.filter(canSee);
              if (visible.length === 0) return null;
              return (
                <div key={g.section ?? gi} className={cn(gi > 0 && "mt-5")}>
                  {g.section && (
                    <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                      {g.section}
                    </p>
                  )}
                  <div className="space-y-0.5">
                    {visible.map((t) => {
                      const active = activeTab === t.key;
                      return (
                        <button
                          key={t.key}
                          onClick={() => setTab(t.key)}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition",
                            active
                              ? "bg-emerald-50 text-emerald-700"
                              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                          )}
                        >
                          {active && <span className="absolute left-0 h-5 w-0.5 rounded-full bg-emerald-600" aria-hidden />}
                          <t.icon className={cn("h-4 w-4 shrink-0", active ? "text-emerald-600" : "text-slate-400 group-hover:text-slate-500")} />
                          <span className="flex-1 truncate text-left">{t.label}</span>
                          {active && <ChevronRight className="h-3.5 w-3.5 text-emerald-400" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>
        </aside>

        {/* ── Content ── */}
        <div className="min-w-0 flex-1 max-w-3xl">
          {activeTab === "account"       && <AccountTab />}
          {activeTab === "general"       && <GeneralTab />}
          {activeTab === "pipeline"      && isStageAdmin  && <LeadStagesTab />}
          {activeTab === "whatsapp"      && <WhatsAppTab />}
          {activeTab === "quick-replies" && <QuickRepliesTab />}
          {activeTab === "billing"       && canSeeBilling && <BillingTab />}
          {activeTab === "opt-out"       && isStageAdmin  && <OptOutTab />}
          {activeTab === "webhooks"      && isStageAdmin  && <WebhooksTab />}
          {activeTab === "message-rates" && isStageAdmin  && <MessageRatesTab />}
          {activeTab === "notifications" && <NotificationsTab />}
          {activeTab === "activity"      && <ActivityTab />}
        </div>
      </div>
    </div>
  );
}
