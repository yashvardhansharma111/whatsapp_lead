"use client";

// Allow / role default / withhold, for one permission.
//
// Three states rather than a switch, because "left at whatever the role gives" is not
// the same as "deliberately withheld": only the second survives a change of role. The
// Admins screen drew this inline; a customer's own people need the identical control,
// so it lives here and both use it.

import { Check, Minus, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PermissionCell {
  roleDefault: boolean;
  override: boolean | null;
  effective: boolean;
}

export function PermissionTriState({
  value,
  disabled,
  onChange,
}: {
  value: boolean | null;
  disabled?: boolean;
  onChange: (next: boolean | null) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      {([true, null, false] as const).map((option) => {
        const active = value === option;
        return (
          <button
            key={String(option)}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option)}
            aria-pressed={active}
            aria-label={
              option === true ? "Allow" : option === false ? "Withhold" : "Use the role default"
            }
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg ring-1 ring-inset transition disabled:opacity-60",
              active
                ? option === true
                  ? "bg-emerald-600 text-white ring-emerald-600"
                  : option === false
                    ? "bg-rose-600 text-white ring-rose-600"
                    : "bg-slate-700 text-white ring-slate-700"
                : "bg-white text-slate-400 ring-slate-200 hover:text-slate-600",
            )}
          >
            {option === true ? <Check className="h-4 w-4" />
              : option === false ? <X className="h-4 w-4" />
              : <Minus className="h-4 w-4" />}
          </button>
        );
      })}
    </div>
  );
}
