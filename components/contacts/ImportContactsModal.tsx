"use client";

import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ImportWizard, type ImportWizardConfig } from "@/components/import/ImportWizard";
import { useContactTags } from "@/hooks/useContacts";
import { useImportContacts } from "@/hooks/useContacts";
import { IMPORT_FIELDS, validateRows, type ImportContactPayload } from "@/lib/contactsImport";
import { ImportGrouping } from "./ImportGrouping";

/**
 * Contact import — a thin binding of the shared `ImportWizard` to the contact field
 * map, the contact validator and the contacts bulk-import hook. All of the flow UI
 * (upload, mapping, preview, progress, report) lives in the wizard and is shared with
 * the Leads importer.
 */
export function ImportContactsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { mutateAsync } = useImportContacts();
  const { data: labels = [] } = useContactTags();
  const queryClient = useQueryClient();
  // Labels to put on every row in this file. The client case this exists for is one
  // hospital importing each location's list separately and then broadcasting per
  // location — the label is a property of the file, not of any column in it.
  const [importTags, setImportTags] = useState<string[]>([]);
  /** Empty means no segment is saved for this import. */
  const [segmentName, setSegmentName] = useState("");

  /**
   * Save the labelled batch as a segment, once the rows are actually in.
   *
   * A segment is a stored rule, so this does not copy anybody into anything — it saves
   * "has any of these labels" under a name. That is what makes the imported group show
   * up on the Segments screen, and it keeps being right as more contacts get the label.
   */
  const saveSegment = useCallback(async () => {
    const name = segmentName.trim();
    if (!name || importTags.length === 0) return;
    const res = await fetch("/api/segments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description: `Everyone labelled ${importTags.join(", ")}.`,
        filters: { rules: [{ field: "tags", op: "any", values: importTags }] },
      }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json?.error ?? "The contacts were imported, but the segment could not be saved.");
    }
    await queryClient.invalidateQueries({ queryKey: ["segments"] });
  }, [importTags, segmentName, queryClient]);

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
      preImportControls: (
        <ImportGrouping
          labels={labels}
          selected={importTags}
          onSelect={setImportTags}
          segmentName={segmentName}
          onSegmentName={setSegmentName}
        />
      ),
      onImported: saveSegment,
      mappingHint: (
        <>
          Your file needs a header row. A <span className="font-medium">Phone</span> column is
          required; all other columns are optional. Tags can be comma-separated. Any other
          columns can be kept as custom fields.
        </>
      ),
    }),
    [mutateAsync, labels, importTags, segmentName, saveSegment],
  );

  return <ImportWizard open={open} onClose={onClose} config={config} />;
}
