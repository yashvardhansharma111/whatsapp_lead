"use client";

// One row in a chat menu: an icon, what it does, and a line about what happens if you
// pick it. Shared by the composer's "+" and the header's, so the two read the same.

import { cn } from "@/lib/utils";

export function MenuItem({
  icon: Icon,
  label,
  hint,
  tone = "slate",
  disabled,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint?: string;
  tone?: "slate" | "emerald" | "amber";
  disabled?: boolean;
  onClick: () => void;
}) {
  const iconTone =
    tone === "emerald" ? "text-emerald-600" : tone === "amber" ? "text-amber-600" : "text-slate-400";
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-start gap-2.5 px-3 py-2 text-left transition hover:bg-slate-50 disabled:opacity-50"
    >
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", iconTone)} />
      <span className="min-w-0">
        <span className="block text-sm text-slate-800">{label}</span>
        {hint && <span className="block text-[11px] leading-tight text-slate-400">{hint}</span>}
      </span>
    </button>
  );
}
