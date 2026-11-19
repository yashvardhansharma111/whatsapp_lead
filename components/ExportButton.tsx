"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * Export, as a spreadsheet or as a PDF.
 *
 * The CSV rides the session cookie, so a plain anchor click authenticates the same way a
 * page navigation does — no token juggling. The PDF opens the printable view and lets
 * the browser's own "Save as PDF" make the file: nothing renders PDFs on the server, and
 * a server-side writer's built-in fonts cannot draw the Devanagari and emoji that real
 * contact names contain.
 */
export function ExportButton({
  resource,
  label = "Export",
  variant = "secondary",
}: {
  resource: "contacts" | "leads" | "campaigns" | "analytics" | "faq-interest" | "ivr-responses";
  label?: string;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const downloadCsv = () => {
    setOpen(false);
    setBusy(true);
    const a = document.createElement("a");
    a.href = `/api/export?resource=${resource}`;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    a.remove();
    // The browser takes over the download; re-enable shortly after.
    setTimeout(() => setBusy(false), 1200);
  };

  const openPdf = () => {
    setOpen(false);
    // A new tab, because the print dialog opens over it and closing it should not take
    // the page they were working on with it.
    window.open(`/export/print?resource=${resource}`, "_blank", "noopener");
  };

  return (
    <div ref={wrapRef} className="relative">
      <Button variant={variant} onClick={() => setOpen((v) => !v)} disabled={busy} aria-haspopup="menu" aria-expanded={open}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {label}
      </Button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-11 z-30 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          <Item
            icon={FileSpreadsheet}
            title="Spreadsheet (CSV)"
            hint="Opens in Excel or Sheets. Phone numbers stay whole."
            onClick={downloadCsv}
          />
          <Item
            icon={FileText}
            title="PDF"
            hint="Opens a printable copy — choose Save as PDF."
            onClick={openPdf}
          />
        </div>
      )}
    </div>
  );
}

function Item({
  icon: Icon,
  title,
  hint,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn("flex w-full items-start gap-2.5 px-3 py-2 text-left transition hover:bg-slate-50")}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
      <span className="min-w-0">
        <span className="block text-sm text-slate-800">{title}</span>
        <span className="block text-[11px] leading-tight text-slate-400">{hint}</span>
      </span>
    </button>
  );
}
