"use client";

import { useState, type ReactNode } from "react";
import { RotateCcw, X } from "lucide-react";
import { Card } from "@/components/ui";
import { Toggle } from "@/components/ui/Toggle";
import { cn } from "@/lib/utils";

/**
 * The colour a card's icon carries. It is the one thing distinguishing otherwise
 * identical panels at a glance, so it tracks meaning rather than decoration: what stops
 * something is rose, what resumes it is emerald, and anything merely informational stays
 * neutral.
 */
export type CardTone = "emerald" | "rose" | "blue" | "amber" | "slate";

const TONE: Record<CardTone, string> = {
  emerald: "bg-emerald-50 text-emerald-600 ring-emerald-100",
  rose:    "bg-rose-50 text-rose-600 ring-rose-100",
  blue:    "bg-blue-50 text-blue-600 ring-blue-100",
  amber:   "bg-amber-50 text-amber-600 ring-amber-100",
  slate:   "bg-slate-100 text-slate-500 ring-slate-200",
};

/**
 * The card and row shapes the AI settings page established, pulled out so the handover
 * and lead-qualification panels look like they belong beside it rather than near it.
 */
export function SettingsCard({
  icon: Icon,
  title,
  description,
  tone = "emerald",
  action,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  tone?: CardTone;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="p-4 transition-shadow hover:shadow-md sm:p-5">
      <div className="flex flex-wrap items-start gap-3 border-b border-slate-100 pb-4">
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-4", TONE[tone])}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          <p className="mt-0.5 text-sm leading-snug text-slate-500">{description}</p>
        </div>
        {action}
      </div>
      <div className="mt-4 space-y-4">{children}</div>
    </Card>
  );
}

/**
 * A card's heading, for the panels whose bodies are too particular to hand to
 * `SettingsCard`. Same badge and rhythm, dropped in place of a bare `<h2>`.
 */
export function CardHead({
  icon: Icon,
  title,
  description,
  tone = "emerald",
  action,
  bordered = true,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  tone?: CardTone;
  action?: ReactNode;
  /** False when the card's own body already draws the separator. */
  bordered?: boolean;
}) {
  return (
    <div className={cn("flex flex-wrap items-start gap-3", bordered && "border-b border-slate-100 pb-4")}>
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-4", TONE[tone])}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-sm leading-snug text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Puts a card's values back to the ones shipped with the product. */
export function ResetButton({ onClick, label = "Reset to default" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
    >
      <RotateCcw className="h-3 w-3" />
      {label}
    </button>
  );
}

/**
 * The explainer that opens a settings panel.
 *
 * It answers "what does this page even do" before the controls do, and it is dismissible
 * because that question is only asked once. The dismissal is a per-viewer convenience, so
 * it lives in this browser and nowhere else, and the panel reads correctly without it.
 */
export function SettingsIntro({
  icon: Icon,
  title,
  storageKey,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  /** Remembers the dismissal for this browser only. Omit to make it permanent. */
  storageKey?: string;
  children: ReactNode;
}) {
  const [dismissed, setDismissed] = useState(() => {
    if (!storageKey || typeof window === "undefined") return false;
    try { return window.localStorage.getItem(`intro:${storageKey}`) === "1"; } catch { return false; }
  });
  if (dismissed) return null;

  function dismiss() {
    setDismissed(true);
    try { if (storageKey) window.localStorage.setItem(`intro:${storageKey}`, "1"); } catch { /* private window */ }
  }

  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50/60 p-4 ring-1 ring-inset ring-blue-100 sm:p-5">
      {/* Decorative, and behind the text so it never competes with it. */}
      <ChatterMark className="pointer-events-none absolute -right-2 bottom-0 hidden h-24 w-36 text-blue-200/70 sm:block" />

      <div className="relative flex items-start gap-3 pr-6">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm shadow-blue-600/20">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-blue-950">{title}</h2>
          <div className="mt-1 max-w-xl text-sm leading-relaxed text-blue-900/80">{children}</div>
        </div>
      </div>

      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-2 top-2 rounded-md p-1 text-blue-400 transition hover:bg-blue-100/70 hover:text-blue-700"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Two speech bubbles mid-conversation — the subject of every one of these panels. */
function ChatterMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 144 96" fill="none" aria-hidden className={className}>
      <path
        d="M30 20h50a10 10 0 0 1 10 10v20a10 10 0 0 1-10 10H48l-14 10V60h-4a10 10 0 0 1-10-10V30a10 10 0 0 1 10-10Z"
        fill="currentColor" opacity="0.45"
      />
      <path
        d="M74 44h40a10 10 0 0 1 10 10v16a10 10 0 0 1-10 10H96l-12 9v-9h-10a10 10 0 0 1-10-10V54a10 10 0 0 1 10-10Z"
        fill="currentColor"
      />
      <g fill="#fff" opacity="0.9">
        <circle cx="92" cy="62" r="3.5" /><circle cx="104" cy="62" r="3.5" /><circle cx="116" cy="62" r="3.5" />
      </g>
    </svg>
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
