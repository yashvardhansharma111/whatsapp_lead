"use client";

// Looking at a template without editing it.
//
// The only way to see what one actually looked like was to open it in the builder,
// which is the screen for changing it — so reading meant entering an editor and backing
// out again, with a real chance of saving something by accident.

import { Badge, Modal } from "@/components/ui";
import { TemplatePreview } from "@/components/templates/TemplatePreview";
import { initialDraft } from "@/components/templates/TemplateBuilder";
import type { TemplateDTO } from "@/hooks/useTemplates";

const STATUS_TONE: Record<string, string> = {
  APPROVED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  PENDING:   "bg-amber-50 text-amber-700 ring-amber-600/20",
  SUBMITTED: "bg-amber-50 text-amber-700 ring-amber-600/20",
  REJECTED:  "bg-rose-50 text-rose-700 ring-rose-600/20",
  DISABLED:  "bg-rose-50 text-rose-700 ring-rose-600/20",
  DRAFT:     "bg-slate-100 text-slate-600 ring-slate-500/20",
};

export function TemplatePreviewModal({
  template,
  onClose,
}: {
  template: TemplateDTO | null;
  onClose: () => void;
}) {
  if (!template) return null;

  return (
    <Modal
      open
      onClose={onClose}
      title={template.name}
      description="What this template looks like on the customer's phone. Variables show their examples."
    >
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <Badge className={STATUS_TONE[template.status ?? "DRAFT"] ?? STATUS_TONE.DRAFT}>
          {String(template.status ?? "draft").toLowerCase()}
        </Badge>
        <span className="text-slate-500">{template.category}</span>
        <span className="text-slate-400">·</span>
        <span className="text-slate-500">{template.language}</span>
      </div>

      <TemplatePreview draft={initialDraft(template)} />
    </Modal>
  );
}
