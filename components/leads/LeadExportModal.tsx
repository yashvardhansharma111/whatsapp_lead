"use client";

import { useState } from "react";
import { Check, Download, Filter, Loader2, RotateCcw } from "lucide-react";
import { Button, Field, Modal, SkeletonText, inputClass } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { downloadLeadsCsv, useLeadFilterOptions } from "@/hooks/useLeadQualification";
import { cn } from "@/lib/utils";

const SORT_LABELS: Record<string, string> = {
  newest:     "Newest first",
  oldest:     "Oldest first",
  score_high: "Highest score first",
  score_low:  "Lowest score first",
  value_high: "Biggest deal first",
  recent_ai:  "Most recently scored",
  updated:    "Recently updated",
};

const SCORE_LABEL_TEXT: Record<string, string> = {
  QUALIFIED: "Qualified", HOT: "Hot", WARM: "Warm", COLD: "Cold",
};

const SOURCE_TEXT: Record<string, string> = {
  AI: "Scored by AI", MANUAL: "Added by hand", IMPORT: "Imported", API: "Through the API",
};

const OUTCOME_TEXT: Record<string, string> = {
  OPEN: "Still open", WON: "Won", LOST: "Lost",
};

/** A yes / no / either control, which is what most of these filters actually are. */
function TriState({
  label, value, onChange, yes = "Yes", no = "No",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  yes?: string;
  no?: string;
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-slate-600">{label}</p>
      <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
        {[
          { v: "", t: "Either" },
          { v: "1", t: yes },
          { v: "0", t: no },
        ].map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            className={cn(
              "flex-1 rounded-md px-2 py-1 text-xs font-medium transition",
              value === o.v ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700",
            )}
          >
            {o.t}
          </button>
        ))}
      </div>
    </div>
  );
}

function Chips({
  options, selected, onToggle, labels,
}: {
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
  labels?: Record<string, string>;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = selected.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => onToggle(o)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium transition",
              on
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
            )}
          >
            {labels?.[o] ?? o}
          </button>
        );
      })}
    </div>
  );
}

const EMPTY = {
  search: "", stageId: [] as string[], assignedToId: [] as string[],
  scoreLabel: [] as string[], qualifiedBy: [] as string[], tags: [] as string[],
  outcome: "ALL", minScore: "", maxScore: "", minValue: "", maxValue: "",
  minConfidence: "", createdFrom: "", createdTo: "", qualifiedFrom: "", qualifiedTo: "",
  aiQualified: "", unassigned: "", decisionMaker: "", hasBudget: "", hasTimeline: "",
  closed: "", sort: "newest",
};

/**
 * Everything a lead export can be narrowed by, and every column it can carry.
 *
 * The same filters the list endpoint takes, because both build one query on the server.
 * A download that quietly differs from the screen it came from is worse than no download.
 */
export function LeadExportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: options, isLoading } = useLeadFilterOptions();
  const { showToast } = useToast();
  const [filters, setFilters] = useState({ ...EMPTY });
  const [columns, setColumns] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  const chosenColumns = columns ?? options?.defaultColumns ?? [];
  const set = <K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));
  const toggleIn = (key: "stageId" | "assignedToId" | "scoreLabel" | "qualifiedBy" | "tags", v: string) =>
    setFilters((f) => ({
      ...f,
      [key]: f[key].includes(v) ? f[key].filter((x) => x !== v) : [...f[key], v],
    }));

  async function download() {
    setBusy(true);
    try {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(filters)) {
        if (Array.isArray(value)) {
          if (value.length) params.set(key, value.join(","));
        } else if (value && value !== "ALL") {
          params.set(key, value);
        }
      }
      if (chosenColumns.length) params.set("columns", chosenColumns.join(","));

      const rows = await downloadLeadsCsv(params);
      showToast(
        rows === 0
          ? "Nothing matched those filters, so the file is empty."
          : `${rows.toLocaleString()} lead${rows === 1 ? "" : "s"} downloaded.`,
        rows === 0 ? "info" : "success",
      );
      if (rows > 0) onClose();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "The export failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Export leads"
      description="Narrow the list, pick the columns, and download it as a CSV."
      className="sm:max-w-2xl"
    >
      {isLoading || !options ? (
        <SkeletonText lines={8} />
      ) : (
        <div className="space-y-5">
          {/* ── Filters ── */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                <Filter className="h-3.5 w-3.5 text-slate-400" />
                Which leads
              </p>
              <button
                type="button"
                onClick={() => setFilters({ ...EMPTY })}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition hover:text-slate-700"
              >
                <RotateCcw className="h-3 w-3" />
                Clear
              </button>
            </div>

            <div className="space-y-3 rounded-xl border border-slate-200 p-3">
              <Field label="Search" htmlFor="lx-search">
                <input
                  id="lx-search"
                  value={filters.search}
                  onChange={(e) => set("search", e.target.value)}
                  className={inputClass}
                  placeholder="Name, phone, company, requirement or summary"
                />
              </Field>

              {options.stages.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium text-slate-600">Stage</p>
                  <Chips
                    options={options.stages.map((s) => s.id)}
                    selected={filters.stageId}
                    onToggle={(v) => toggleIn("stageId", v)}
                    labels={Object.fromEntries(options.stages.map((s) => [s.id, s.name]))}
                  />
                </div>
              )}

              <div>
                <p className="mb-1 text-xs font-medium text-slate-600">Rating</p>
                <Chips options={options.scoreLabels} selected={filters.scoreLabel}
                  onToggle={(v) => toggleIn("scoreLabel", v)} labels={SCORE_LABEL_TEXT} />
              </div>

              <div>
                <p className="mb-1 text-xs font-medium text-slate-600">Where it came from</p>
                <Chips options={options.qualifiedBy} selected={filters.qualifiedBy}
                  onToggle={(v) => toggleIn("qualifiedBy", v)} labels={SOURCE_TEXT} />
              </div>

              {options.agents.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium text-slate-600">Owner</p>
                  <Chips
                    options={options.agents.map((a) => a.id)}
                    selected={filters.assignedToId}
                    onToggle={(v) => toggleIn("assignedToId", v)}
                    labels={Object.fromEntries(options.agents.map((a) => [a.id, a.name]))}
                  />
                </div>
              )}

              {options.tags.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium text-slate-600">Contact tags</p>
                  <Chips options={options.tags.map((t) => t.name)} selected={filters.tags}
                    onToggle={(v) => toggleIn("tags", v)} />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Field label="Score from" htmlFor="lx-minscore">
                  <input id="lx-minscore" type="number" min={0} max={100} value={filters.minScore}
                    onChange={(e) => set("minScore", e.target.value)} className={inputClass} placeholder="0" />
                </Field>
                <Field label="Score to" htmlFor="lx-maxscore">
                  <input id="lx-maxscore" type="number" min={0} max={100} value={filters.maxScore}
                    onChange={(e) => set("maxScore", e.target.value)} className={inputClass} placeholder="100" />
                </Field>
                <Field label="Value from" htmlFor="lx-minvalue">
                  <input id="lx-minvalue" type="number" min={0} value={filters.minValue}
                    onChange={(e) => set("minValue", e.target.value)} className={inputClass} placeholder="0" />
                </Field>
                <Field label="Value to" htmlFor="lx-maxvalue">
                  <input id="lx-maxvalue" type="number" min={0} value={filters.maxValue}
                    onChange={(e) => set("maxValue", e.target.value)} className={inputClass} />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Field label="Created from" htmlFor="lx-cfrom">
                  <input id="lx-cfrom" type="date" value={filters.createdFrom}
                    onChange={(e) => set("createdFrom", e.target.value)} className={inputClass} />
                </Field>
                <Field label="Created to" htmlFor="lx-cto">
                  <input id="lx-cto" type="date" value={filters.createdTo}
                    onChange={(e) => set("createdTo", e.target.value)} className={inputClass} />
                </Field>
                <Field label="Scored from" htmlFor="lx-qfrom">
                  <input id="lx-qfrom" type="date" value={filters.qualifiedFrom}
                    onChange={(e) => set("qualifiedFrom", e.target.value)} className={inputClass} />
                </Field>
                <Field label="Scored to" htmlFor="lx-qto">
                  <input id="lx-qto" type="date" value={filters.qualifiedTo}
                    onChange={(e) => set("qualifiedTo", e.target.value)} className={inputClass} />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <TriState label="Scored by the AI" value={filters.aiQualified}
                  onChange={(v) => set("aiQualified", v)} yes="Only scored" no="Never scored" />
                <TriState label="Has an owner" value={filters.unassigned}
                  onChange={(v) => set("unassigned", v === "1" ? "0" : v === "0" ? "1" : "")}
                  yes="Assigned" no="Unassigned" />
                <TriState label="Speaks for the decision" value={filters.decisionMaker}
                  onChange={(v) => set("decisionMaker", v)} />
                <TriState label="Budget known" value={filters.hasBudget}
                  onChange={(v) => set("hasBudget", v)} />
                <TriState label="Timeline known" value={filters.hasTimeline}
                  onChange={(v) => set("hasTimeline", v)} />
                <TriState label="Closed" value={filters.closed}
                  onChange={(v) => set("closed", v)} yes="Closed" no="Still open" />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label="Outcome" htmlFor="lx-outcome">
                  <select id="lx-outcome" value={filters.outcome} onChange={(e) => set("outcome", e.target.value)}
                    className={inputClass}>
                    <option value="ALL">Any outcome</option>
                    {options.outcomes.map((o) => (
                      <option key={o} value={o}>{OUTCOME_TEXT[o] ?? o}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Minimum AI confidence" htmlFor="lx-conf">
                  <input id="lx-conf" type="number" min={0} max={100} value={filters.minConfidence}
                    onChange={(e) => set("minConfidence", e.target.value)} className={inputClass} placeholder="any" />
                </Field>
                <Field label="Order" htmlFor="lx-sort">
                  <select id="lx-sort" value={filters.sort} onChange={(e) => set("sort", e.target.value)}
                    className={inputClass}>
                    {options.sorts.map((s) => (
                      <option key={s} value={s}>{SORT_LABELS[s] ?? s}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>
          </div>

          {/* ── Columns ── */}
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-700">
                Columns
                <span className="ml-1.5 font-normal text-slate-400">{chosenColumns.length} of {options.columns.length}</span>
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setColumns(options.columns.map((c) => c.key))}
                  className="text-xs font-medium text-slate-500 hover:text-slate-700">
                  Everything
                </button>
                <button type="button" onClick={() => setColumns([...options.defaultColumns])}
                  className="text-xs font-medium text-slate-500 hover:text-slate-700">
                  The usual
                </button>
              </div>
            </div>

            <div className="scrollbar-slim grid max-h-44 grid-cols-2 gap-1 overflow-y-auto rounded-xl border border-slate-200 p-2 sm:grid-cols-3">
              {options.columns.map((c) => {
                const on = chosenColumns.includes(c.key);
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() =>
                      setColumns(on ? chosenColumns.filter((k) => k !== c.key) : [...chosenColumns, c.key])
                    }
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs transition",
                      on ? "bg-emerald-50 text-emerald-800" : "text-slate-600 hover:bg-slate-50",
                    )}
                  >
                    <span className={cn(
                      "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border",
                      on ? "border-emerald-500 bg-emerald-500" : "border-slate-300",
                    )}>
                      {on && <Check className="h-2.5 w-2.5 text-white" />}
                    </span>
                    <span className="truncate">{c.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Up to ten thousand rows per file. Columns come out in the order shown here.
            </p>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={download} disabled={busy || chosenColumns.length === 0}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {busy ? "Preparing…" : "Download CSV"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
