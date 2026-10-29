"use client";

import type { ReactNode } from "react";
import { Card } from "@/components/ui";
import { Toggle } from "@/components/ui/Toggle";
import { cn } from "@/lib/utils";

/**
 * The card and row shapes the AI settings page established, pulled out so the handover
 * and lead-qualification panels look like they belong beside it rather than near it.
 */
export function SettingsCard({
  icon: Icon,
  title,
  description,
  action,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start gap-3 border-b border-slate-100 pb-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          <p className="mt-0.5 text-sm text-slate-500">{description}</p>
        </div>
        {action}
      </div>
      <div className="mt-4 space-y-4">{children}</div>
    </Card>
  );
}

export function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className={cn(
      "flex items-center justify-between gap-4 rounded-lg border border-slate-200 px-3 py-2.5",
      disabled && "opacity-60",
    )}>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-800">{label}</span>
        {hint && <span className="block text-xs leading-snug text-slate-500">{hint}</span>}
      </span>
      <Toggle checked={checked} onChange={onChange} label={label} disabled={disabled} />
    </div>
  );
}

/** A labelled row for a number with its unit, used for thresholds and counts. */
export function NumberRow({
  label,
  hint,
  value,
  onChange,
  min,
  max,
  unit,
  placeholder,
  id,
}: {
  label: string;
  hint?: string;
  value: number | null;
  onChange: (v: number | null) => void;
  min: number;
  max: number;
  unit: string;
  placeholder?: string;
  id: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-2.5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">{label}</label>
      <div className="mt-1.5 flex items-center gap-2">
        <input
          id={id}
          type="number"
          min={min}
          max={max}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          placeholder={placeholder}
          className="w-24 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <span className="text-sm text-slate-500">{unit}</span>
      </div>
      {hint && <p className="mt-1 text-xs leading-snug text-slate-500">{hint}</p>}
    </div>
  );
}

/**
 * A free-text keyword list. Typed one per line, which beats a tag widget here: these are
 * phrases, people paste them from a spreadsheet, and a line break is the obvious
 * separator for "speak to someone".
 */
export function KeywordList({
  id,
  label,
  hint,
  value,
  onChange,
  placeholderList,
}: {
  id: string;
  label: string;
  hint: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholderList: string[];
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">{label}</label>
      <textarea
        id={id}
        rows={3}
        value={value.join("\n")}
        onChange={(e) => onChange(e.target.value.split("\n").map((k) => k.trim()).filter(Boolean))}
        placeholder={placeholderList.slice(0, 4).join("\n")}
        className="mt-1.5 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
      <p className="mt-1 text-xs leading-snug text-slate-500">{hint}</p>
    </div>
  );
}
