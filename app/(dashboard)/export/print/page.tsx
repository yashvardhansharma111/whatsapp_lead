"use client";

// A printable copy of an export — the PDF option.
//
// Nothing renders a PDF on the server: contact names here carry Devanagari and the emoji
// people put in their WhatsApp display names, and a server-side PDF writer's built-in
// fonts turn both into blank boxes. The browser already has the fonts, already renders
// the page, and its own "Save as PDF" is a real PDF — so the page is simply made worth
// printing and the browser asked to print it.
//
// The rows come from the export endpoint, so what is printed and what is downloaded can
// never be two different lists.

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

interface ExportRows {
  title: string;
  headers: string[];
  rows: unknown[][];
  phoneColumns: string[];
}

/** "optedOut" → "Opted out", so a printed sheet reads like a document, not a schema. */
function headerLabel(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

function cellText(value: unknown, isPhone: boolean): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  const s = String(value);
  // Shown in full, with the country code: the stored form is digits only.
  if (isPhone) return `+${s.replace(/[^\d]/g, "")}`;
  // An ISO timestamp is unreadable on paper.
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    }
  }
  return s;
}

export default function ExportPrintPage() {
  const params = useSearchParams();
  const resource = params.get("resource") ?? "contacts";
  // A ref, not state: printing once is a fact about this mount, not something to render.
  const printed = useRef(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["export-print", resource],
    queryFn: async () => {
      const res = await fetch(`/api/export?resource=${encodeURIComponent(resource)}&format=json`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Couldn't load this export");
      return (json.data ?? json) as ExportRows;
    },
  });

  // Printed once the table is on the page — printing a skeleton produces a blank sheet.
  useEffect(() => {
    if (!data || printed.current) return;
    printed.current = true;
    const t = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(t);
  }, [data]);

  if (isLoading) return <p className="p-8 text-sm text-slate-500">Preparing…</p>;
  if (isError) return <p className="p-8 text-sm text-rose-700">{(error as Error).message}</p>;
  if (!data) return null;

  const phone = new Set(data.phoneColumns);

  return (
    <div className="bg-white p-8 text-slate-900 print:p-0">
      <style>{`
        @media print {
          /* The dashboard chrome is not part of the document. */
          nav, aside, header, .no-print { display: none !important; }
          @page { margin: 14mm; }
          thead { display: table-header-group; }
          tr { break-inside: avoid; }
        }
      `}</style>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{data.title}</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {data.rows.length.toLocaleString("en-IN")} row{data.rows.length === 1 ? "" : "s"} ·{" "}
            {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="no-print rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-700"
        >
          Print / Save as PDF
        </button>
      </div>

      {data.rows.length === 0 ? (
        <p className="text-sm text-slate-500">Nothing to print — this export is empty.</p>
      ) : (
        <table className="w-full border-collapse text-left text-[11px]">
          <thead>
            <tr className="border-b-2 border-slate-300">
              {data.headers.map((h) => (
                <th key={h} className="px-2 py-1.5 font-semibold uppercase tracking-wide text-slate-500">
                  {headerLabel(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, i) => (
              <tr key={i} className="border-b border-slate-100">
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className={`px-2 py-1.5 align-top ${phone.has(data.headers[j]) ? "whitespace-nowrap font-mono" : ""}`}
                  >
                    {cellText(cell, phone.has(data.headers[j]))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
