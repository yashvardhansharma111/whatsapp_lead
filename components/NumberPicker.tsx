"use client";

import { Phone } from "lucide-react";
import { numberLabel, useWhatsAppNumbers, type WhatsAppNumber } from "@/hooks/useWhatsAppNumbers";
import { cn } from "@/lib/utils";

/**
 * Which WhatsApp number to use.
 *
 * Hidden when the workspace has only one, because a dropdown with a single option is
 * just noise. Anywhere this is absent, the default number is used.
 */
export function NumberPicker({
  value,
  onChange,
  /** The label for "no particular number", on a filter. Omit on a chooser. */
  anyLabel,
  id,
  label,
  hint,
  className,
  disabled,
}: {
  value: string;
  onChange: (id: string) => void;
  anyLabel?: string;
  id: string;
  label?: string;
  hint?: string;
  className?: string;
  disabled?: boolean;
}) {
  const { numbers, hasChoice, isLoading } = useWhatsAppNumbers();
  if (isLoading || !hasChoice) return null;

  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      )}
      <div className="relative">
        <Phone className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={cn(
            "w-full appearance-none rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-7 text-sm text-slate-700",
            "focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60",
          )}
        >
          {anyLabel && <option value="">{anyLabel}</option>}
          {numbers.map((n) => (
            <option key={n.id} value={n.id}>
              {numberLabel(n)}{n.isDefault ? " · default" : ""}
            </option>
          ))}
        </select>
      </div>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

/** A small label saying which number a thread is on. */
export function NumberBadge({ number, className }: { number: WhatsAppNumber | null; className?: string }) {
  const { hasChoice } = useWhatsAppNumbers();
  // With one number connected, saying which one is noise on every row.
  if (!hasChoice || !number) return null;

  return (
    <span className={cn(
      "inline-flex shrink-0 items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600",
      className,
    )}>
      <Phone className="h-2.5 w-2.5" />
      {number.displayName?.trim() || number.phoneNumber || "number"}
    </span>
  );
}
