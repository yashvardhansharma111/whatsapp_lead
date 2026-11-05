"use client";

import { useMemo, useState } from "react";
import { ImportWizard, type ImportWizardConfig } from "@/components/import/ImportWizard";
import { useContactTags } from "@/hooks/useContacts";
import { useImportContacts } from "@/hooks/useContacts";
import { IMPORT_FIELDS, validateRows, type ImportContactPayload } from "@/lib/contactsImport";

/**
 * Contact import — a thin binding of the shared `ImportWizard` to the contact field
 * map, the contact validator and the contacts bulk-import hook. All of the flow UI
 * (upload, mapping, preview, progress, report) lives in the wizard and is shared with
 * the Leads importer.
 */
export function ImportContactsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { mutateAsync } = useImportContacts();
  const { data: labels = [] } = useContactTags();
  // Labels to put on every row in this file. The client case this exists for is one
  // hospital importing each location's list separately and then broadcasting per
  // location — the label is a property of the file, not of any column in it.
  const [importTags, setImportTags] = useState<string[]>([]);

  const config = useMemo<ImportWizardConfig<ImportContactPayload>>(
    () => ({
      title: "Import Contacts",
      description: "Bring contacts in from an Excel or CSV file.",
      fields: IMPORT_FIELDS,
      validate: validateRows,
      customFields: true,
      importBatch: (payload, mode, dryRun, meta) =>
        mutateAsync({ contacts: payload, mode, dryRun, ...meta, importTags }),
      sampleFiles: [
        { label: "Excel (.xlsx)", href: "/contacts-sample.xlsx" },
        { label: "CSV", href: "/contacts-sample.csv" },
      ],
      columnGuide: [
        { header: "Phone",       example: "+919876543210",    required: true },
        { header: "Name",        example: "Rahul Sharma" },
        { header: "Email",       example: "rahul@acme.com" },
        { header: "Company",     example: "Acme Pvt Ltd" },
        { header: "Designation", example: "Manager" },
        { header: "Location",    example: "Mumbai" },
        { header: "Source",      example: "Website" },
        { header: "Notes",       example: "Interested in plan A" },
        { header: "Labels",      example: "hot, vip" },
      ],
      preImportControls: labels.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
          <p className="text-xs font-medium text-slate-700">Label everyone in this file</p>
          <p className="mb-2 text-[11px] text-slate-500">
            Optional. Applied on top of any Labels column, so you can import one
            location&apos;s list and broadcast to just that label later.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {labels.map((l) => {
              const on = importTags.includes(l.name);
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() =>
                    setImportTags((prev) =>
                      on ? prev.filter((n) => n !== l.name) : [...prev, l.name],
                    )
                  }
                  className={`rounded-full border px-2.5 py-1 text-xs transition ${
                    on
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {l.name}
                </button>
              );
            })}
          </div>
        </div>
      ),
      mappingHint: (
        <>
          Your file needs a header row. A <span className="font-medium">Phone</span> column is
          required; all other columns are optional. Tags can be comma-separated. Any other
          columns can be kept as custom fields.
        </>
      ),
    }),
    [mutateAsync, labels, importTags],
  );

  return <ImportWizard open={open} onClose={onClose} config={config} />;
}
