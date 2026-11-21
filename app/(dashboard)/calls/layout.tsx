"use client";

// Calls and their recordings were two sidebar entries for one subject — and a recording
// only exists because a call happened. Tabs, as real routes, so a link to either still
// works.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/calls", label: "History" },
  { href: "/calls/recordings", label: "Recordings" },
];

export default function CallsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="mx-auto max-w-7xl">
      <nav
        aria-label="Call sections"
        className="scrollbar-slim mb-5 flex gap-1 overflow-x-auto border-b border-slate-200"
      >
        {TABS.map((t) => {
          const active = t.href === "/calls" ? pathname === t.href : pathname.startsWith(t.href);
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
