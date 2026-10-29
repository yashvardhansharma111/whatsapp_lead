"use client";

import { FileSpreadsheet, History, Loader2 } from "lucide-react";
import { EmptyState, Modal } from "@/components/ui";
import { useContactImports, type ContactImportRun } from "@/hooks/useContacts";
import { cn, formatDate, formatTime } from "@/lib/utils";

export function ImportHistoryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data = [], isLoading, isError } = useContactImports(open);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Import history"
      description="Every spreadsheet import into this workspace, newest first."
      className="max-w-3xl"
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
        </div>
      ) : isError ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">Couldn&apos;t load import history. Try again in a moment.</p>
      ) : data.length === 0 ? (
        <EmptyState
          icon={History}
          title="No imports yet"
          description="Imports you run from the Import button will show up here with their results."
        />
      ) : (
        <div className="scrollbar-slim max-h-[60vh] overflow-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[40rem] text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">File</th>
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">By</th>
                <th className="px-3 py-2 font-medium">Duplicates</th>
                <th className="nums px-3 py-2 text-right font-medium">Rows</th>
                <th className="nums px-3 py-2 text-right font-medium">Created</th>
                <th className="nums px-3 py-2 text-right font-medium">Updated</th>
                <th className="nums px-3 py-2 text-right font-medium">Skipped</th>
                <th className="nums px-3 py-2 text-right font-medium">Failed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((run) => (
                <Row key={run.id} run={run} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

function Row({ run }: { run: ContactImportRun }) {
  return (
    <tr className="text-slate-700">
      <td className="max-w-56 px-3 py-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <FileSpreadsheet className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="min-w-0">
            <span className="block truncate font-medium text-slate-800">{run.fileName || "Untitled file"}</span>
            {run.sheetName && <span className="block truncate text-[11px] text-slate-400">Sheet: {run.sheetName}</span>}
          </span>
        </span>
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-slate-500">
        {formatDate(run.createdAt)} · {formatTime(run.createdAt)}
      </td>
      <td className="max-w-40 truncate px-3 py-2 text-slate-500">{run.importedBy?.name || run.importedBy?.email || "—"}</td>
      <td className="px-3 py-2">
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[11px] font-medium",
            run.mode === "update" ? "bg-sky-50 text-sky-700" : "bg-slate-100 text-slate-600",
          )}
        >
          {run.mode === "update" ? "Updated" : "Skipped"}
        </span>
      </td>
      <Num value={run.total} />
      <Num value={run.created} tone="text-emerald-700" />
      <Num value={run.updated} tone="text-sky-700" />
      <Num value={run.skipped} />
      <Num value={run.failed} tone={run.failed > 0 ? "text-rose-600" : undefined} />
    </tr>
  );
}

function Num({ value, tone }: { value: number; tone?: string }) {
  return <td className={cn("nums px-3 py-2 text-right", tone ?? "text-slate-600")}>{value.toLocaleString()}</td>;
}
