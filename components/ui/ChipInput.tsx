"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

/**
 * A set of short, distinct words — opt-out keywords, and anything else where each entry is
 * one token rather than a phrase. Each is removable on sight, which a textarea cannot do.
 */
export function ChipInput({
  values,
  onChange,
  placeholder,
  /** Uppercase letters only, as WhatsApp keywords are matched. */
  normalise = (raw) => raw.trim().toUpperCase().replace(/[^A-Z]/g, ""),
  emptyHint,
  inputId,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  normalise?: (raw: string) => string;
  emptyHint?: string;
  inputId: string;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const value = normalise(draft);
    setDraft("");
    if (!value || values.includes(value)) return;
    onChange([...values, value]);
  }

  return (
    <div className="space-y-2.5">
      {values.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {values.map((value) => (
            <span
              key={value}
              className="group inline-flex items-center gap-1 rounded-full bg-slate-100 py-1 pl-2.5 pr-1.5 font-mono text-xs font-medium text-slate-700 transition hover:bg-slate-200/80"
            >
              {value}
              <button
                type="button"
                onClick={() => onChange(values.filter((v) => v !== value))}
                aria-label={`Remove ${value}`}
                className="rounded-full p-0.5 text-slate-400 transition hover:bg-white hover:text-rose-600"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        emptyHint && <p className="text-xs text-slate-400">{emptyHint}</p>
      )}

      <div className="flex gap-2">
        <input
          id={inputId}
          value={draft}
          onChange={(e) => setDraft(e.target.value.toUpperCase())}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 font-mono text-xs text-slate-900 transition placeholder:font-sans placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 sm:max-w-xs"
        />
        <button
          type="button"
          onClick={add}
          disabled={!normalise(draft)}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
      </div>
    </div>
  );
}
