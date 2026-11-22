"use client";

/**
 * Where this file's contacts should land: a label on every row, and optionally a segment
 * that holds them.
 *
 * The label picker here used to be hidden entirely when a workspace had no labels yet —
 * which is every workspace doing its first import, the one time marking the batch matters
 * most. Labels can be created from here now, so the first import can be grouped.
 *
 * A segment is a saved rule, not a bag of contacts, so "add them to a segment" cannot mean
 * writing rows into one. What it means is: label the file, then save the rule "has this
 * label" under a name. The result is what was asked for — the import shows up as a segment
 * on the Segments screen — and it stays true afterwards, because a contact given the label
 * next week appears there too.
 */

import { useState } from "react";
import { Check, Loader2, Plus, Tag } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { inputClass } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { ContactTagOption } from "@/hooks/useContacts";

export function ImportGrouping({
  labels,
  selected,
  onSelect,
  segmentName,
  onSegmentName,
}: {
  labels: ContactTagOption[];
  selected: string[];
  onSelect: (next: string[]) => void;
  /** Empty means "don't save a segment". */
  segmentName: string;
  onSegmentName: (next: string) => void;
}) {
  const qc = useQueryClient();
  const [fresh, setFresh] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (name: string) =>
    onSelect(selected.includes(name) ? selected.filter((n) => n !== name) : [...selected, name]);

  async function createLabel() {
    const name = fresh.trim();
    if (!name || creating) return;
    if (labels.some((l) => l.name.toLowerCase() === name.toLowerCase())) {
      // Already there, just not picked — saying "exists" and doing nothing would read as
      // a failure when the thing they want is one click away.
      const existing = labels.find((l) => l.name.toLowerCase() === name.toLowerCase())!;
      if (!selected.includes(existing.name)) toggle(existing.name);
      setFresh("");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color: "#6366f1" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Couldn't create that label");
      await qc.invalidateQueries({ queryKey: ["contacts", "tags"] });
      await qc.invalidateQueries({ queryKey: ["tags"] });
      onSelect([...selected, name]);
      setFresh("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create that label");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
      <div>
        <p className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
          <Tag className="h-3.5 w-3.5 text-slate-400" />
          Label everyone in this file
        </p>
        <p className="mt-0.5 text-[11px] text-slate-500">
          Optional, and applied on top of any Labels column — so you can bring in one
          location&apos;s list and broadcast to just that label later.
        </p>
      </div>

      {labels.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {labels.map((l) => {
            const on = selected.includes(l.name);
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => toggle(l.name)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition",
                  on
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                )}
              >
                {on && <Check className="h-3 w-3" />}
                {l.name}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex gap-1.5">
        <input
          value={fresh}
          onChange={(e) => setFresh(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); void createLabel(); }
          }}
          maxLength={40}
          placeholder={labels.length ? "Or type a new label…" : "Create your first label…"}
          className={cn(inputClass, "flex-1 py-1.5 text-base sm:text-sm")}
        />
        <button
          type="button"
          onClick={() => void createLabel()}
          disabled={!fresh.trim() || creating}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
        >
          {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Add
        </button>
      </div>

      {error && <p className="text-[11px] text-rose-600">{error}</p>}

      {selected.length > 0 && (
        <div className="border-t border-slate-200 pt-3">
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={segmentName.length > 0}
              onChange={(e) => onSegmentName(e.target.checked ? suggestName(selected) : "")}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-emerald-600"
            />
            <span className="min-w-0">
              <span className="block text-xs font-medium text-slate-700">
                Save this group as a segment
              </span>
              <span className="block text-[11px] text-slate-500">
                Creates a segment for everyone with {selected.length === 1 ? "this label" : "these labels"},
                so the batch is on the Segments screen the moment the import finishes.
              </span>
            </span>
          </label>

          {segmentName.length > 0 && (
            <input
              value={segmentName}
              onChange={(e) => onSegmentName(e.target.value)}
              maxLength={60}
              placeholder="Segment name"
              className={cn(inputClass, "mt-2 py-1.5 text-base sm:text-sm")}
            />
          )}
        </div>
      )}
    </div>
  );
}

/** A name someone would have typed anyway, so the field is rarely edited. */
function suggestName(labels: string[]): string {
  return labels.length === 1 ? labels[0] : labels.slice(0, 3).join(" + ");
}
