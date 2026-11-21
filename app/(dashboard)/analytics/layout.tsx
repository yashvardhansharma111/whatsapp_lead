"use client";

// Analytics, Reports and Messages-per-number were three sidebar entries answering the
// same question with different cuts of the same data, and nothing on any of them said
// the other two existed. They are tabs on one screen now.
//
// Real routes rather than local state: each tab keeps its own URL, so a link to a
// particular view still works and the browser's back button does what it looks like it
// does.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/analytics", label: "Overview" },
  { href: "/analytics/reports", label: "Reports" },
  { href: "/analytics/numbers", label: "Per number" },
];

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto max-w-7xl">
      <nav
        aria-label="Analytics sections"
        className="scrollbar-slim mb-5 flex gap-1 overflow-x-auto border-b border-slate-200"
      >
        {TABS.map((t) => {
          // Exact match for the overview, or every sub-route would light it up too.
          const active = t.href === "/analytics" ? pathname === t.href : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition",
                active
                  ? "border-emerald-600 text-emerald-700"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
