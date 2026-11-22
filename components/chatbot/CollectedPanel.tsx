"use client";

/**
 * What this flow writes down about each person, and which step writes it.
 *
 * The question people actually ask when they open a flow builder is "where does a
 * customer's answer end up?", and nothing answered it. The variable list existed only
 * as chips under a text box — useful once you already knew what a variable was, and no
 * help at all to someone who does not.
 *
 * So this reads the flow itself and says it plainly: the question as the customer will
 * be asked it, the name its answer is filed under, and the fact that those names are
 * the columns of the export. An unnamed step is called out, because that is the one
 * mistake that silently throws a customer's answer away.
 */

import { useState } from "react";
import { ChevronDown, Database, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FlowNode } from "@/lib/chatbot/types";

export interface Collected {
  /** The name the answer is filed under, or null when the step has not been given one. */
  name: string | null;
  /** What the customer is asked, so the row reads as the conversation does. */
  asks: string;
  /** Which kind of step records it, in the words the palette uses. */
  from: string;
}

const STEP_LABEL: Record<string, string> = {
  question:     "Question",
  menu:         "Menu",
  set_variable: "Set value",
  api:          "API call",
  ai:           "AI reply",
};

/** Every answer this flow records, in the order the steps appear on the canvas. */
export function collectedBy(nodes: FlowNode[]): Collected[] {
  const out: Collected[] = [];
  for (const n of nodes) {
    const d = (n.data ?? {}) as {
      variable?: unknown; saveAs?: unknown; question?: unknown; prompt?: unknown; label?: unknown;
    };
    const records = n.type === "question" || n.type === "menu"
      || n.type === "set_variable" || n.type === "api" || n.type === "ai";
    if (!records) continue;

    const name = typeof d.variable === "string" && d.variable.trim() ? d.variable.trim()
      : typeof d.saveAs === "string" && d.saveAs.trim() ? d.saveAs.trim()
      : null;
    const asks =
      (typeof d.question === "string" && d.question.trim()) ||
      (typeof d.prompt === "string" && d.prompt.trim()) ||
      (typeof d.label === "string" && d.label.trim()) ||
      STEP_LABEL[n.type] || n.type;

    out.push({ name, asks, from: STEP_LABEL[n.type] ?? n.type });
  }
  return out;
}

export function CollectedPanel({ nodes }: { nodes: FlowNode[] }) {
  const [open, setOpen] = useState(true);
  const rows = collectedBy(nodes);
  if (!rows.length) return null;

  const unnamed = rows.filter((r) => !r.name).length;

  return (
    <div className="border-t border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        <Database className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
        <span className="flex-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          What this flow records
        </span>
        {unnamed > 0 && (
          <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">
            {unnamed} unnamed
          </span>
        )}
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <div className="px-3 pb-3">
          <ul className="space-y-1.5">
            {rows.map((r, i) => (
              <li key={i} className="rounded-lg bg-slate-50 px-2.5 py-2">
                <p className="truncate text-xs text-slate-700" title={r.asks}>{r.asks}</p>
                {r.name ? (
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    saved as <span className="font-mono text-slate-700">{r.name}</span> · {r.from}
                  </p>
                ) : (
                  <p className="mt-0.5 flex items-start gap-1 text-[11px] text-amber-700">
                    <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                    No name, so this answer is used once and then thrown away.
                  </p>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            Each name above is a column in <b>Chatbot → Export responses</b>, with one row
            per customer. The same names go in a message as <span className="font-mono">{"{{name}}"}</span>.
          </p>
        </div>
      )}
    </div>
  );
}
