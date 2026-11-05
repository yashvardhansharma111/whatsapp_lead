"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Ban, BarChart2, BookOpen, Bot, Building2, ChevronRight, CreditCard, FileBarChart2, FileText, Filter, LayoutDashboard, LayoutTemplate, LogOut, Megaphone, Menu, MessageSquare, Palette, Phone, Send, Settings, Sparkles, Tag, Target, Ticket, UserCheck, UserCog, Users, X, Mic, Smartphone, Package,} from "lucide-react";
import type { PlanFeatures } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui";
import { BusinessSwitcher } from "@/components/dashboard/BusinessSwitcher";
import { WorkspaceSwitcher } from "@/components/dashboard/WorkspaceSwitcher";
import { useHandoverWaiting } from "@/hooks/useHandovers";

/** Grouped so eleven links don't read as one undifferentiated wall. */
const NAV = [
  {
    section: null,
    items: [
      { href: "/inbox", label: "Inbox", icon: MessageSquare, permission: "conversations.view" },
      { href: "/calls", label: "Calls", icon: Phone, permission: "conversations.view", feature: "callingEnabled" as keyof PlanFeatures },
      { href: "/contacts", label: "Contacts", icon: Users, permission: "contacts.view" },
      { href: "/tags", label: "Labels", icon: Tag, permission: "contacts.view" },
      { href: "/leads", label: "Leads", icon: Target, permission: "contacts.view" },
    ],
  },
  {
    section: "Automate",
    items: [
      { href: "/campaigns", label: "Campaigns", icon: Megaphone, permission: "campaigns.view" },
      { href: "/segments", label: "Segments", icon: Filter, permission: "contacts.view" },
      { href: "/contact-lists", label: "Contact lists", icon: Users, permission: "contacts.view" },
      { href: "/broadcast", label: "Bulk Broadcast", icon: Send, permission: "campaigns.send" },
      { href: "/templates", label: "Templates", icon: FileText, permission: "campaigns.view" },
      { href: "/catalogue", label: "Catalogue", icon: Package, permission: "conversations.view" },
      { href: "/chatbot", label: "Chatbot", icon: Bot, permission: "settings.manage" },
      { href: "/ai-settings", label: "AI Settings", icon: Sparkles, permission: "settings.manage" },
      { href: "/knowledge-base", label: "Knowledge Base", icon: BookOpen, permission: "settings.manage" },
    ],
  },
  {
    section: "Manage",
    items: [
      { href: "/tickets", label: "Tickets", icon: Ticket, permission: "conversations.view" },
      { href: "/recordings", label: "Recordings", icon: Mic, permission: "conversations.view" },
      // The badge shows how many people are waiting on a person right now.
      { href: "/handovers", label: "Transfers", icon: UserCheck, permission: "conversations.view", badge: "handovers" as const },
      { href: "/analytics", label: "Analytics", icon: BarChart2, permission: "reports.view" },
      { href: "/reports", label: "Reports", icon: FileBarChart2, permission: "reports.view" },
      { href: "/reports/numbers", label: "Messages per number", icon: Smartphone, permission: "reports.view" },
      { href: "/blacklist", label: "Blacklist", icon: Ban, permission: "blacklist.view" },
      { href: "/team", label: "Team", icon: UserCog, permission: "users.manage" },
      { href: "/billing", label: "Billing & Plan", icon: CreditCard, permission: "billing.manage" },
      // Open to every member: the page always has their own account and notification
      // preferences on it. Each tab inside gates itself.
      { href: "/settings", label: "Settings", icon: Settings, permission: undefined },
    ],
  },
];

/**
 * A reseller account manages client accounts and never works inside one, so it
 * gets its own menu — no inbox, contacts or campaigns (the API refuses those too).
 */
const RESELLER_NAV = [
  {
    section: null,
    items: [
      { href: "/reseller", label: "Overview", icon: LayoutDashboard, permission: "reseller.clients.view" },
      { href: "/reseller/clients", label: "Clients", icon: Building2, permission: "reseller.clients.view" },
      { href: "/reseller/plans", label: "Plans", icon: CreditCard, permission: "reseller.plans.manage" },
      { href: "/billing", label: "Billing & Plan", icon: CreditCard, permission: "billing.manage" },
      { href: "/reseller/branding", label: "Branding", icon: Palette, permission: "whitelabel.manage", whiteLabelOnly: true },
      { href: "/reseller/website", label: "Website", icon: LayoutTemplate, permission: "whitelabel.manage", whiteLabelOnly: true },
    ],
  },
  {
    section: "Manage",
    items: [
      { href: "/team", label: "Team", icon: UserCog, permission: "users.manage" },
      { href: "/settings", label: "Settings", icon: Settings, permission: undefined },
    ],
  },
];

/**
 * A link appears only if the server would actually serve the page behind it.
 *
 * This replaced per-item role lists: a workspace owner can now grant or revoke any of
 * these individually, and the nav follows the grant rather than the role name. Fails
 * closed while permissions are still loading — a brief empty group beats offering a page
 * that 403s.
 */
function canSeeNavItem(permissions: string[] | undefined, required: string | undefined) {
  if (!required) return true;
  return Array.isArray(permissions) && permissions.includes(required);
}

/** Items tied to a plan feature stay hidden until the tenant's plan switches it on. */
function planAllows(item: { href: string; feature?: keyof PlanFeatures }, features: PlanFeatures | null | undefined) {
  return !item.feature || Boolean(features?.[item.feature]);
}

export interface SidebarUser {
  name?: string | null;
  role?: string | null;
  avatar?: string | null;
  tenantName?: string | null;
  plan?: string | null;
  accountType?: string | null;
  resellerType?: string | null;
  features?: PlanFeatures | null;
  permissions?: string[];
}

/** The brand shown in the sidebar — the platform's, or a white-label reseller's. */
export interface SidebarBrand {
  name: string;
  logoUrl: string | null;
}

function prettyRole(role?: string | null) {
  if (!role) return "";
  return role
    .toLowerCase()
    .split("_")
    .map((w) => (w[0]?.toUpperCase() ?? "") + w.slice(1))
    .join(" ");
}

export function Sidebar({ user, brand }: { user: SidebarUser; brand: SidebarBrand }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  // Only asked for when the person can see the queue at all.
  const { data: waiting = 0 } = useHandoverWaiting();
  const isReseller = user.accountType === "RESELLER";
  const groups = isReseller
    ? RESELLER_NAV.map((g) => ({
        ...g,
        items: g.items.filter((i) => !("whiteLabelOnly" in i && i.whiteLabelOnly) || user.resellerType === "WHITE_LABEL"),
      }))
    : NAV;

  const nav = (
    <>
      <div className="flex h-16 shrink-0 items-center gap-2.5 px-5">
        {brand.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a reseller's logo on its own host
          <img src={brand.logoUrl} alt="" className="h-8 w-8 rounded-lg object-contain" />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 shadow-sm shadow-emerald-600/30">
            <MessageSquare className="h-4 w-4 text-white" />
          </span>
        )}
        <span className="truncate text-[15px] font-semibold tracking-tight text-slate-900">{brand.name}</span>
        <button
          onClick={() => setMobileOpen(false)}
          className="ml-auto rounded-lg p-1 text-slate-400 hover:bg-slate-100 lg:hidden"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="scrollbar-slim flex-1 overflow-y-auto px-3 pb-3">
        {groups.map((group, gi) => {
          const items = group.items.filter(
            (item) => canSeeNavItem(user.permissions, item.permission) && planAllows(item, user.features),
          );
          if (items.length === 0) return null;
          return (
          <div key={group.section ?? gi} className={cn(gi > 0 && "mt-5")}>
            {group.section && (
              <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {group.section}
              </p>
            )}
            <div className="space-y-0.5">
              {items.map((item) => {
                const { href, label, icon: Icon } = item;
                const count = "badge" in item && item.badge === "handovers" ? waiting : 0;
                const active = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                      active
                        ? "bg-emerald-50 font-semibold text-emerald-700"
                        : "font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                    )}
                  >
                    {/* The rail is what makes the active row read instantly at a glance. */}
                    {active && (
                      <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-emerald-600" />
                    )}
                    <Icon
                      className={cn(
                        "h-[18px] w-[18px] shrink-0 transition",
                        active ? "text-emerald-600" : "text-slate-400 group-hover:text-slate-500",
                      )}
                    />
                    <span className="truncate">{label}</span>
                    {count > 0 && (
                      <span className="ml-auto shrink-0 rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white">
                        {count > 99 ? "99+" : count}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-slate-100 p-3">
        {/* Current plan chip — only for client accounts that have a plan loaded */}
        {!isReseller && user.plan && (
          <Link
            href="/billing"
            className="mb-2.5 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs ring-1 ring-slate-200 transition hover:bg-emerald-50 hover:ring-emerald-200"
          >
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Current plan</p>
              <p className="truncate font-semibold text-slate-800">{user.plan}</p>
            </div>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          </Link>
        )}

        <div className="flex items-center gap-2.5">
          <Avatar name={user.name} src={user.avatar} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900">{user.name ?? "User"}</p>
            <p className="truncate text-xs text-slate-500">{prettyRole(user.role)}</p>
          </div>
          <button
            onClick={() => signOut({ redirect: false }).then(() => { window.location.href = "/login"; })}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        {/* Workspaces this person belongs to — their own plus any they were invited to.
            Renders nothing when there is only one. */}
        <div className="-mx-3 mt-2.5">
          <WorkspaceSwitcher />
        </div>

        {/* Businesses are WhatsApp workspaces inside one account; a reseller has none. */}
        {!isReseller && (
          <div className="mt-2.5">
            <BusinessSwitcher />
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-3.5 z-30 rounded-lg bg-white p-2 text-slate-600 shadow-sm ring-1 ring-slate-900/5 lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200/70 bg-white lg:flex">
        {nav}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="relative flex h-full w-64 flex-col bg-white shadow-xl">{nav}</aside>
        </div>
      )}
    </>
  );
}
