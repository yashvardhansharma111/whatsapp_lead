"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A request, shown the way a terminal would show it.
 *
 * API examples were light grey `<pre>` blocks, which read as a dump of text that had
 * been pasted rather than something meant to be used. A dark block says "this is code",
 * separates it from the prose around it at a glance, and leaves room for the two things
 * a reader actually wants: which verb it is, and the ability to take it away.
 */
export function CodeBlock({
  code,
  method,
  path,
  className,
}: {
  code: string;
  /** Rendered as a coloured pill in the block's header. */
  method?: HttpMethod;
  path?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access can be refused; the text is selectable either way.
    }
  }

  return (
    <div className={cn("overflow-hidden rounded-lg bg-slate-900 ring-1 ring-slate-900/10", className)}>
      {(method || path) && (
        <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
          {method && <MethodBadge method={method} />}
          {path && <code className="min-w-0 flex-1 truncate font-mono text-xs text-slate-300">{path}</code>}
        </div>
      )}

      <div className="relative">
        <pre className="scrollbar-slim overflow-x-auto px-3 py-3 font-mono text-xs leading-relaxed text-slate-200">
          {code}
        </pre>
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? "Copied" : "Copy to clipboard"}
          className="absolute right-2 top-2 rounded-md bg-white/5 p-1.5 text-slate-400 opacity-0 transition hover:bg-white/10 hover:text-white focus-visible:opacity-100 group-hover:opacity-100 sm:opacity-100"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

/** Colour follows what the verb does: reads are calm, writes are not. */
const METHOD_TONE: Record<HttpMethod, string> = {
  GET:    "bg-sky-500/15 text-sky-300 ring-sky-400/30",
  POST:   "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30",
  PATCH:  "bg-amber-500/15 text-amber-300 ring-amber-400/30",
  PUT:    "bg-amber-500/15 text-amber-300 ring-amber-400/30",
  DELETE: "bg-rose-500/15 text-rose-300 ring-rose-400/30",
};

export function MethodBadge({ method }: { method: HttpMethod }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wide ring-1 ring-inset",
        METHOD_TONE[method],
      )}
    >
      {method}
    </span>
  );
}

/** The same pill on a light surface, for a list of endpoints outside a code block. */
const METHOD_TONE_LIGHT: Record<HttpMethod, string> = {
  GET:    "bg-sky-50 text-sky-700 ring-sky-600/20",
  POST:   "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  PATCH:  "bg-amber-50 text-amber-800 ring-amber-600/20",
  PUT:    "bg-amber-50 text-amber-800 ring-amber-600/20",
  DELETE: "bg-rose-50 text-rose-700 ring-rose-600/20",
};

export function MethodPill({ method }: { method: HttpMethod }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wide ring-1 ring-inset",
        METHOD_TONE_LIGHT[method],
      )}
    >
      {method}
    </span>
  );
}
