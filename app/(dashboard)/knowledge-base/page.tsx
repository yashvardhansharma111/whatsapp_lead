"use client";

/**
 * The documents the AI reads. Nothing else.
 *
 * FAQ editing used to expand inside these cards, which is what made it feel
 * cramped: a card in a three-column grid is about 380px wide, and an editor
 * needs room for a multi-line question, a paragraph of answer, and controls that
 * do not sit on top of either. Expanding one card also grew it past its
 * neighbours and shoved the rest of the page down.
 *
 * So the card went back to being a summary — what this file is, whether it is
 * indexed, how many questions it has — and the FAQ count became a link to
 * /knowledge-base/faqs, which has the whole width to work with.
 */

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  FileText,
  HelpCircle,
  Layers,
  Loader2,
  MessagesSquare,
  RefreshCw,
  Sparkles,
  Pencil,
  Trash2,
  UploadCloud,
} from "lucide-react";
type KnowledgeDoc = { id: string; tenantId: string; businessId: string; name: string; type: string; url?: string | null; textLength: number; vectorIds: string[]; chunkCount: number; isIndexed: boolean; metadata?: unknown; createdAt: string; updatedAt: string; };
import { Badge, Button, Card, EmptyState, Field, inputClass, Modal, PageHeader, Skeleton } from "@/components/ui";
import { readFaqState } from "@/lib/knowledgeFaq";
import { UploadModal } from "@/components/knowledge/UploadModal";
import { RetrievalTester } from "@/components/knowledge/RetrievalTester";
import { cn, formatDate } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { fetchAllPages } from "@/lib/fetchAll";

/**
 * Whether the AI can read this document.
 *
 * Text is extracted when the file is uploaded and there is no queue behind it, so there is
 * no waiting state to show: either there is text or there is not. The old PROCESSING state
 * was a spinner that never stopped, because the worker it claimed to be waiting for was
 * never built — and the four PDFs in the live database that say "Indexed" have no text in
 * them at all. A document the AI cannot read now says so, with the reason.
 */
type DocStatus = "READABLE" | "EMPTY";

function readStatus(doc: KnowledgeDoc): { status: DocStatus; error?: string } {
  if (doc.textLength > 0) return { status: "READABLE" };
  const meta = doc.metadata;
  const problem =
    meta && typeof meta === "object" && !Array.isArray(meta)
      ? (meta as Record<string, unknown>).problem
      : undefined;
  return {
    status: "EMPTY",
    error:
      typeof problem === "string"
        ? problem
        : "No text was stored for this document. Upload it again.",
  };
}

function useKnowledgeDocs() {
  return useQuery<KnowledgeDoc[]>({
    queryKey: ["knowledge"],
    queryFn: async () => {
      // Searched and filtered in the page, so a server page would hide documents.
      return fetchAllPages<KnowledgeDoc>("/api/knowledge");
    },
    retry: false,
    // Text is extracted while the upload request is still open, so a document never changes
    // state on its own and there is nothing to poll for. This used to refetch every three
    // seconds for as long as any document sat in PROCESSING — which, with no worker to move
    // it out of that state, was forever.
  });
}

/** `metadata` is free-form JSON on the model; the size may or may not be there. */
function readSize(doc: KnowledgeDoc): string {
  const meta = doc.metadata;
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    const raw = (meta as Record<string, unknown>).size;
    if (typeof raw === "number") {
      if (raw < 1024) return `${raw} B`;
      if (raw < 1024 * 1024) return `${(raw / 1024).toFixed(0)} KB`;
      return `${(raw / (1024 * 1024)).toFixed(1)} MB`;
    }
    if (typeof raw === "string") return raw;
  }
  return "—";
}

export default function KnowledgeBasePage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { data, isLoading, isError, error } = useKnowledgeDocs();
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<KnowledgeDoc | null>(null);
  // Renaming changes the label this page and the FAQ picker show. The text itself is read
  // out of the file on upload and is not editable — replacing a document means uploading
  // it again.
  const [renameDoc, setRenameDoc] = useState<KnowledgeDoc | null>(null);
  const [draftName, setDraftName] = useState("");
  const docs = data ?? [];

  const readable = docs.filter((d) => d.textLength > 0).length;
  const unreadable = docs.length - readable;
  const faqs = docs.reduce((sum, d) => sum + readFaqState(d.metadata).faqs.length, 0);

  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await fetch(`/api/knowledge/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error ?? "Rename failed");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge"] });
      setRenameDoc(null);
    },
    onError: (e: Error) => showToast(e.message, "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/knowledge/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? "Delete failed");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge"] });
      setConfirmDelete(null);
    },
    onError: (e: Error) => showToast(e.message, "error"),
  });

  const reindexMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/knowledge/${id}/reindex`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error ?? "Re-index failed");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge"] });
    },
  });

  return (
    <div>
      <PageHeader
        title="Knowledge Base"
        description="Documents the AI reads before answering a customer."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => setOpen(true)}>
              <UploadCloud className="h-4 w-4" />
              Upload
            </Button>
            <Link href="/knowledge-base/faqs">
              <Button>
                <MessagesSquare className="h-4 w-4" />
                FAQs
              </Button>
            </Link>
          </div>
        }
      />

      {docs.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900 ring-1 ring-inset ring-emerald-600/20">
          <span className="inline-flex items-center gap-2 font-medium">
            <Sparkles className="h-4 w-4 shrink-0" />
            The AI is reading <strong>{readable}</strong> document{readable === 1 ? "" : "s"}
          </span>
          {unreadable > 0 && (
            <span className="font-medium text-rose-700">
              {unreadable} with no text — upload {unreadable === 1 ? "it" : "them"} again
            </span>
          )}
          {/* Third number on the same line because it belongs to the same
              question — how much does the AI actually know — and because it is
              the only pointer from here to the FAQ screen. */}
          <Link
            href="/knowledge-base/faqs"
            className="ml-auto inline-flex items-center gap-1.5 font-medium text-emerald-800 underline-offset-2 hover:underline"
          >
            <HelpCircle className="h-4 w-4" />
            {faqs} FAQ{faqs === 1 ? "" : "s"} written
          </Link>
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-5">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <Skeleton className="mt-4 h-4 w-3/4" />
              <Skeleton className="mt-2 h-3 w-1/2" />
              <Skeleton className="mt-5 h-3 w-full" />
            </Card>
          ))}
        </div>
      ) : isError || docs.length === 0 ? (
        <Card>
          <EmptyState
            icon={BookOpen}
            title={isError ? "Couldn't load your documents" : "No documents yet"}
            description={
              isError
                ? (error as Error)?.message ?? "Something went wrong fetching them. Try again in a moment."
                : "Upload a PDF, DOCX or TXT — or point us at a URL — and the AI will use it to answer customer questions."
            }
            action={
              <Button onClick={() => setOpen(true)}>
                <UploadCloud className="h-4 w-4" />
                Upload Document
              </Button>
            }
          />
        </Card>
      ) : (
        // Equal-height cards again, now that nothing expands in place. items-start
        // was only ever there to stop an opened FAQ list stretching its whole row.
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              deleting={deleteMutation.isPending && deleteMutation.variables === doc.id}
              reindexing={reindexMutation.isPending && reindexMutation.variables === doc.id}
              onDelete={() => setConfirmDelete(doc)}
              onRename={() => {
                setDraftName(doc.name);
                setRenameDoc(doc);
              }}
              onReindex={() => reindexMutation.mutate(doc.id)}
            />
          ))}
        </div>
      )}

      {!isLoading && !isError && docs.length > 0 && <RetrievalTester />}

      <UploadModal open={open} onClose={() => setOpen(false)} />

      <Modal
        open={!!renameDoc}
        onClose={() => {
          if (!renameMutation.isPending) setRenameDoc(null);
        }}
        title="Rename document"
        description="This changes the name shown here and in the FAQ picker. The document's content and its search index are unchanged."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const name = draftName.trim();
            if (renameDoc && name) renameMutation.mutate({ id: renameDoc.id, name });
          }}
        >
          <Field label="Document name">
            <input
              className={inputClass}
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              maxLength={200}
              autoFocus
            />
          </Field>
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end max-sm:[&>button]:h-10 max-sm:[&>button]:w-full">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setRenameDoc(null)}
              disabled={renameMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={renameMutation.isPending || !draftName.trim()}>
              {renameMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!confirmDelete}
        onClose={() => { if (!deleteMutation.isPending) setConfirmDelete(null); }}
        title="Delete document?"
        description={confirmDelete ? `"${confirmDelete.name}" will be removed from the knowledge base and the AI will no longer have access to it.` : ""}
      >
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end max-sm:[&>button]:h-10 max-sm:[&>button]:w-full">
          <Button
            variant="secondary"
            onClick={() => setConfirmDelete(null)}
            disabled={deleteMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={deleteMutation.isPending}
            onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}
          >
            {deleteMutation.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Deleting…</>
            ) : (
              "Delete document"
            )}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function DocumentCard({
  doc,
  deleting,
  reindexing,
  onDelete,
  onRename,
  onReindex,
}: {
  doc: KnowledgeDoc;
  deleting: boolean;
  reindexing: boolean;
  onDelete: () => void;
  onRename: () => void;
  onReindex: () => void;
}) {
  const { status, error } = readStatus(doc);
  const faqCount = readFaqState(doc.metadata).faqs.length;

  return (
    <Card className="group flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
          <FileText className="h-5 w-5" />
        </span>
        <div className="flex items-center gap-1">
          <button
            aria-label={`Rename ${doc.name}`}
            className="rounded-lg p-1.5 text-slate-300 transition hover:bg-slate-100 hover:text-slate-600 group-hover:text-slate-400"
            onClick={onRename}
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            aria-label={`Re-index ${doc.name}`}
            disabled={reindexing || doc.type !== "URL"}
            title={
              doc.type === "URL"
                ? "Fetch this page again"
                : "Only a web page can be read again — the uploaded file isn't kept, so upload it again instead"
            }
            className="rounded-lg p-1.5 text-slate-300 transition hover:bg-sky-50 hover:text-sky-600 group-hover:text-slate-400 disabled:opacity-50"
            onClick={onReindex}
          >
            {reindexing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </button>
          <button
            aria-label={`Delete ${doc.name}`}
            disabled={deleting}
            className="rounded-lg p-1.5 text-slate-300 transition hover:bg-rose-50 hover:text-rose-600 group-hover:text-slate-400 disabled:opacity-50"
            onClick={onDelete}
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Two lines rather than one truncated one. Uploaded filenames are long and
          near-identical at the front — "AI-Powered WhatsApp CRM, Automation…"
          told you nothing about which of two files this was. */}
      <p className="mt-4 line-clamp-2 font-medium leading-snug text-slate-900" title={doc.name}>
        {doc.name}
      </p>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <Badge className="uppercase">{doc.type}</Badge>
        {/* Chunks were a count from a vector pipeline that does not exist, so every new
            upload read "0 chunks". How much text came out of the file is the real
            measure of whether the upload worked. */}
        {doc.textLength > 0 && (
          <Badge className="bg-slate-50 text-slate-600">
            <Layers className="mr-1 h-3 w-3" />
            {doc.textLength.toLocaleString()} characters
          </Badge>
        )}
      </div>

      {/* mt-auto pins the status block to the bottom, so every card in a row
          lines its footer up regardless of how long the filename wrapped. */}
      <div className="mt-auto pt-5">
        <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
          {status === "READABLE" ? (
            <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              The AI can read this
            </span>
          ) : (
            <span
              className="inline-flex min-w-0 items-center gap-1 font-medium text-rose-700"
              title={error}
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">No text</span>
            </span>
          )}
          <span className="text-slate-400">{readSize(doc)}</span>
        </div>

        <p className="mt-1.5 text-xs text-slate-400">Uploaded {formatDate(doc.createdAt)}</p>

        {/* A link, not an expander. The editor needs the full width of a page;
            see the note at the top of this file. */}
        {status === "READABLE" && (
          <Link
            href={`/knowledge-base/faqs?doc=${doc.id}`}
            className={cn(
              "mt-3 flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs font-medium transition",
              faqCount > 0
                ? "bg-emerald-50/70 text-emerald-800 hover:bg-emerald-100"
                : "text-slate-500 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 hover:text-slate-800",
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              <HelpCircle className="h-3.5 w-3.5" />
              {faqCount > 0 ? `${faqCount} FAQ${faqCount === 1 ? "" : "s"}` : "Add FAQs"}
            </span>
            <span aria-hidden>→</span>
          </Link>
        )}
      </div>
    </Card>
  );
}
