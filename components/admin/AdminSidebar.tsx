"use client";

import { useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  IndianRupee,
  PanelsTopLeft,
  ScrollText,
  Tags,
  KeyRound,
  Receipt,
  LogOut,
  Menu,
  X,
  BarChart2,
  Palette,
  Ban, SlidersHorizontal, UserCog, Store,} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui";

// `need` is the permission that opens each screen. Staff see only what they hold; the
// Super Admin sees everything. A link to a page that answers 403 is worse than no link.
const NAV_GROUPS = [
  {
    label: "Platform",
    items: [
      { href: "/dashboard",    label: "Dashboard",  icon: LayoutDashboard, need: "platform.tenants.view" },
      { href: "/tenants",      label: "Customers",  icon: Building2,       need: "platform.tenants.view" },
      { href: "/plans",        label: "Plans",      icon: CreditCard,      need: "platform.tenants.view" },
      { href: "/revenue",      label: "Revenue",    icon: IndianRupee,     need: "platform.revenue.view" },
    ],
  },
  {
    // Your own brand was filed under "Resellers", which is where a reseller's brand is
    // configured, not yours — so the one screen that holds the logo, the favicon and the
    // sign-in panel sat under a heading that said it was about somebody else.
    label: "Brand & website",
    items: [
      { href: "/admin/brand",       label: "Brand & icons", icon: Palette,       need: "platform.whitelabel.manage" },
      { href: "/admin/cms",         label: "Website CMS",   icon: PanelsTopLeft, need: "platform.cms.manage" },
    ],
  },
  {
    label: "Resellers",
    items: [
      { href: "/admin/white-label",  label: "White Label",    icon: Store,            need: "platform.whitelabel.manage" },
      { href: "/admin/rates",        label: "Message prices", icon: Receipt,          need: "platform.pricing.manage" },
      { href: "/admin/pricing-policy", label: "Pricing & policy", icon: SlidersHorizontal, need: "platform.pricing.manage" },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/admin/reports",     label: "Reports",     icon: BarChart2,     need: "platform.revenue.view" },
      { href: "/admin/categories",  label: "Categories",  icon: Tags,          need: "platform.categories.manage" },
    ],
  },
  {
    label: "Security",
    items: [
      { href: "/admin/staff",       label: "Admins",      icon: UserCog,    need: "platform.staff.manage" },
      { href: "/admin/permissions", label: "Permissions", icon: KeyRound,   need: "platform.staff.manage" },
      { href: "/admin/blacklist",   label: "Blacklist",   icon: Ban,        need: "platform.tenants.manage" },
      { href: "/audit-logs",        label: "Audit Logs",  icon: ScrollText, need: "platform.audit.view" },
    ],
  },
];

export function AdminSidebar({
  name,
  email,
  permissions,
  brand,
}: {
  name?: string | null;
  email?: string | null;
  /** null means every screen — the Super Admin. */
  permissions?: string[] | null;
  /** The platform's own brand. Hardcoded here until now, so the one screen that
      changes the logo was the one screen that never showed it. */
  brand: { name: string; logoUrl: string | null; primaryColor: string };
}) {
  const pathname = usePathname();
  const groups = NAV_GROUPS.map((g) => ({
    ...g,
    items: permissions ? g.items.filter((i) => permissions.includes(i.need)) : g.items,
  })).filter((g) => g.items.length > 0);
  const [mobileOpen, setMobileOpen] = useState(false);

  const nav = (
    <>
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-slate-200 px-5">
        <BrandMark
          name={brand.name}
          logoUrl={brand.logoUrl}
          color={brand.primaryColor}
          className="h-8 w-8 shrink-0 rounded-lg"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold tracking-tight text-slate-900">{brand.name}</p>
          <p className="truncate text-[11px] text-slate-500">Admin panel</p>
        </div>
        <button
          onClick={() => setMobileOpen(false)}
          className="ml-auto rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 lg:hidden"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="scrollbar-slim flex-1 overflow-y-auto p-3">
        {groups.map((group) => (
          <div key={group.label} className="mb-4">
            <p className="px-3 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                      active
                        ? "bg-emerald-50 text-[#0B6E4F] ring-1 ring-inset ring-emerald-100"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
                    )}
                  >
                    <Icon className={cn("h-4 w-4 shrink-0", active ? "text-[#0B6E4F]" : "text-slate-400")} />
                    <span className="truncate">{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-slate-200 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <Avatar name={name ?? "Super Admin"} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900">{name ?? "Super Admin"}</p>
            <p className="truncate text-xs text-slate-500">{email ?? "—"}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile trigger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-3 z-30 rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Desktop rail */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        {nav}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="relative flex h-full w-64 flex-col border-r border-slate-200 bg-white shadow-xl">
            {nav}
          </aside>
        </div>
      )}
    </>
  );
}