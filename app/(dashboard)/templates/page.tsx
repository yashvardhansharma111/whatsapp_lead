"use client";

import { useMemo, useState } from "react";
import {
  FileText,
  Plus,
  Pencil,
  Copy,
  Trash2,
  Send,
  RefreshCw,
  Download,
  AlertCircle,
  RotateCw,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Modal,
  PageHeader,
  SkeletonRows,
} from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { TemplateBuilder } from "@/components/templates/TemplateBuilder";
import { NumberPicker } from "@/components/NumberPicker";
import { cn, formatDate } from "@/lib/utils";
import {
  useTemplates,
  useDeleteTemplate,
  useDuplicateTemplate,
  useSubmitTemplate,
  useRefreshTemplate,
  useSyncTemplates,
  useImportTemplates,
  type TemplateDTO,
} from "@/hooks/useTemplates";

const STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600 ring-slate-500/20",
  SUBMITTED: "bg-sky-50 text-sky-700 ring-sky-600/20",
  PENDING: "bg-amber-50 text-amber-800 ring-amber-600/20",
  APPROVED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  REJECTED: "bg-rose-50 text-rose-700 ring-rose-600/20",
  DISABLED: "bg-slate-100 text-slate-500 ring-slate-400/20",
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  DISABLED: "Disabled",
};

const TABS = ["ALL", "DRAFT", "SUBMITTED", "PENDING", "APPROVED", "REJECTED", "DISABLED"] as const;
type Tab = (typeof TABS)[number];

const CATEGORY_TABS = ["ALL", "MARKETING", "UTILITY", "AUTHENTICATION"] as const;
type CategoryTab = (typeof CATEGORY_TABS)[number];

const EDITABLE = new Set(["DRAFT", "REJECTED"]);
const DELETABLE = new Set(["DRAFT", "REJECTED", "DISABLED"]);

export default function TemplatesPage() {
  const [tab, setTab] = useState<Tab>("ALL");
  const [categoryTab, setCategoryTab] = useState<CategoryTab>("ALL");
  // Which number's templates to show. A template belongs to a WhatsApp account, so in a
  // workspace with numbers on different accounts the full list is not sendable from any
  // one of them.
  const [numberId, setNumberId] = useState("");
  const { data, isLoading, isError } = useTemplates(numberId || undefined);
  const [modal, setModal] = useState<{ open: boolean; editing: TemplateDTO | null }>({ open: false, editing: null });
  const [rejection, setRejection] = useState<TemplateDTO | null>(null);
  const [confirmDeleteTemplate, setConfirmDeleteTemplate] = useState<TemplateDTO | null>(null);
  const { showToast } = useToast();

  const del = useDeleteTemplate();
  const duplicate = useDuplicateTemplate();
  const submit = useSubmitTemplate();
  const refresh = useRefreshTemplate();
  const syncAll = useSyncTemplates();
  const importFromMeta = useImportTemplates();

  const all: TemplateDTO[] = useMemo(() => data ?? [], [data]);
  const templates = useMemo(
    () => {
      let list = tab === "ALL" ? all : all.filter((t) => t.status === tab);
      if (categoryTab !== "ALL") list = list.filter((t) => t.category === categoryTab);
      return list;
    },
    [all, tab, categoryTab],
  );

  const handleSyncAll = async () => {
    try {
      await syncAll.mutateAsync();
      showToast("Template statuses synced.", "success");
    }
    catch (e) { showToast((e as Error).message, "error"); }
  };

  const handleImport = async () => {
    try {
      const result = await importFromMeta.mutateAsync();
      if (result.created === 0 && result.updated === 0) {
        showToast("No new templates found on Meta.", "info");
      } else {
        showToast(`Imported ${result.created} new, updated ${result.updated} template(s).`, "success");
      }
    } catch (e) {
      showToast((e as Error).message, "error");
    }
  };

  const handleAction = async (p: Promise<unknown>, successMsg?: string) => {
    try {
      await p;
      if (successMsg) showToast(successMsg, "success");
    }
    catch (e) {
      showToast((e as Error).message, "error");
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!confirmDeleteTemplate) return;
    try {
      await del.mutateAsync(confirmDeleteTemplate.id);
      setConfirmDeleteTemplate(null);
      showToast("Template deleted.", "success");
    } catch (e) {
      showToast((e as Error).message, "error");
    }
  };

  // Shared by the desktop table and the phone card list.
  const renderStatus = (t: TemplateDTO) => (
    <div className="flex items-center gap-1.5">
      <Badge className={STATUS_STYLE[t.status] ?? STATUS_STYLE.DRAFT}>
        {STATUS_LABEL[t.status] ?? t.status}
      </Badge>
      {t.status === "REJECTED" && (
        <button
          onClick={() => setRejection(t)}
          className="text-rose-500 hover:text-rose-700"
          aria-label="View rejection reason"
          title="View rejection reason"
        >
          <AlertCircle className="h-4 w-4" />
        </button>
      )}
    </div>
  );
  const renderActions = (t: TemplateDTO) => (
    <>
      {EDITABLE.has(t.status) && (
        <Button
          variant="ghost"
          size="sm"
          title="Submit to Meta"
          aria-label="Submit to Meta"
          disabled={submit.isPending && submit.variables === t.id}
          onClick={() => handleAction(submit.mutateAsync(t.id), "Submitted to Meta for review.")}
        >
          <Send className="h-4 w-4" />
        </Button>
      )}
      {(t.status === "SUBMITTED" || t.status === "PENDING" || (t.waTemplateId && t.status !== "DRAFT")) && (
        <Button
          variant="ghost"
          size="sm"
          title="Refresh status"
          aria-label="Refresh status"
          disabled={refresh.isPending && refresh.variables === t.id}
          onClick={() => handleAction(refresh.mutateAsync(t.id), "Status refreshed.")}
        >
          <RotateCw className="h-4 w-4" />
        </Button>
      )}
      {EDITABLE.has(t.status) && (
        <Button
          variant="ghost"
          size="sm"
          title="Edit"
          aria-label="Edit template"
          onClick={() => setModal({ open: true, editing: t })}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        title="Duplicate"
        aria-label="Duplicate template"
        disabled={duplicate.isPending && duplicate.variables === t.id}
        onClick={() => handleAction(duplicate.mutateAsync(t.id), "Template duplicated.")}
      >
        <Copy className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        title={DELETABLE.has(t.status) ? "Delete" : "Approved/in-review templates can't be deleted"}
        aria-label="Delete template"
        className="text-rose-600 hover:bg-rose-50"
        disabled={!DELETABLE.has(t.status) || (del.isPending && confirmDeleteTemplate?.id === t.id)}
        onClick={() => setConfirmDeleteTemplate(t)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </>
  );

  return (
    <div>
      <PageHeader
        title="Message Templates"
        description="Create WhatsApp templates, submit them to Meta for approval, and use approved ones in campaigns."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              onClick={handleImport}
              disabled={importFromMeta.isPending || syncAll.isPending}
              title="Pull all templates from Meta WABA into this app"
            >
              <Download className={cn("h-4 w-4", importFromMeta.isPending && "animate-bounce")} />
              Import from Meta
            </Button>
            <Button variant="secondary" onClick={handleSyncAll} disabled={syncAll.isPending || importFromMeta.isPending}>
              <RefreshCw className={cn("h-4 w-4", syncAll.isPending && "animate-spin")} />
              Sync status
            </Button>
            <Button onClick={() => setModal({ open: true, editing: null })}>
              <Plus className="h-4 w-4" />
              Create Template
            </Button>
          </div>
        }
      />

      {/* Renders nothing when the workspace has one connected number. */}
      <NumberPicker
        id="templates-number"
        value={numberId}
        onChange={setNumberId}
        anyLabel="All numbers"
        hint="A template can only be sent from a number in its own WhatsApp account."
        className="mb-4 max-w-sm"
      />

      <div className="scrollbar-slim mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition",
              tab === t
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-800",
            )}
          >
            {t === "ALL" ? "All" : STATUS_LABEL[t]}
          </button>
        ))}
      </div>

      <div className="scrollbar-slim mb-4 flex gap-2 overflow-x-auto">
        {CATEGORY_TABS.map((c) => (
          <button
            key={c}
            onClick={() => setCategoryTab(c)}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition",
              categoryTab === c
                ? "bg-emerald-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200",
            )}
          >
            {c === "ALL" ? "All categories" : c.charAt(0) + c.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-4">
            <SkeletonRows rows={6} />
          </div>
        ) : isError || templates.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={isError ? "Templates aren't available yet" : "No templates yet"}
            description={
              isError
                ? "Couldn't load templates. Check that WhatsApp is connected in Settings."
                : "Create your first template and submit it to Meta for approval."
            }
            action={
              <Button onClick={() => setModal({ open: true, editing: null })}>
                <Plus className="h-4 w-4" />
                Create Template
              </Button>
            }
          />
        ) : (
          <>
          {/* Phones: stacked cards instead of the 7-column table */}
          <ul className="divide-y divide-slate-100 md:hidden">
            {templates.map((t) => (
              <li key={t.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-all font-mono text-[13px] font-medium text-slate-900">{t.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {t.category} · <span className="font-mono">{t.language}</span>
                      {t.lastSyncedAt && <> · synced {formatDate(t.lastSyncedAt)}</>}
                    </p>
                  </div>
                  <div className="shrink-0">{renderStatus(t)}</div>
                </div>
                <p className="mt-2 line-clamp-2 text-xs text-slate-500">{t.body}</p>
                <div className="mt-2 flex items-center justify-end gap-1 [&>button]:h-10 [&>button]:w-10">
                  {renderActions(t)}
                </div>
              </li>
            ))}
          </ul>
          <div className="scrollbar-slim hidden overflow-x-auto md:block">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Language</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Last Synced</th>
                  <th className="px-4 py-3 font-medium">Meta ID</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {templates.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-mono text-[13px] font-medium text-slate-900">{t.name}</p>
                      <p className="mt-0.5 max-w-sm truncate text-xs text-slate-500">{t.body}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{t.category}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{t.language}</td>
                    <td className="px-4 py-3">
                      {renderStatus(t)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">
                      {t.lastSyncedAt ? formatDate(t.lastSyncedAt) : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">
                      {t.waTemplateId ? t.waTemplateId.slice(0, 12) + "…" : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">{renderActions(t)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </Card>

      <TemplateBuilder
        key={modal.editing?.id ?? "new"}
        open={modal.open}
        editing={modal.editing}
        onClose={() => setModal({ open: false, editing: null })}
        showToast={showToast}
      />

      <Modal
        open={Boolean(rejection)}
        onClose={() => setRejection(null)}
        title="Rejection reason"
        description={rejection ? `Meta rejected "${rejection.name}".` : ""}
      >
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {rejection?.rejectionReason || "No reason was provided by Meta."}
        </p>
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end [&>button]:h-10 [&>button]:w-full sm:[&>button]:h-9 sm:[&>button]:w-auto">
          <Button variant="secondary" onClick={() => setRejection(null)}>
            Close
          </Button>
        </div>
      </Modal>

      <Modal
        open={!!confirmDeleteTemplate}
        onClose={() => { if (!del.isPending) setConfirmDeleteTemplate(null); }}
        title="Delete template?"
        description={confirmDeleteTemplate ? `"${confirmDeleteTemplate.name}" will be permanently removed and cannot be recovered.` : ""}
      >
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end [&>button]:h-10 [&>button]:w-full sm:[&>button]:h-9 sm:[&>button]:w-auto">
          <Button variant="secondary" onClick={() => setConfirmDeleteTemplate(null)} disabled={del.isPending}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDeleteConfirmed} disabled={del.isPending}>
            {del.isPending ? "Deleting…" : "Delete template"}
          </Button>
        </div>
      </Modal>

    </div>
  );
}
