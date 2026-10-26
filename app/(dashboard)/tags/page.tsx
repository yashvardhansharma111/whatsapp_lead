"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Tag, Trash2 } from "lucide-react";
import { Badge, Button, Card, EmptyState, Modal, PageHeader } from "@/components/ui";
import { useToast } from "@/components/ui/toast";

const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#06b6d4", "#3b82f6", "#64748b", "#1e293b",
];

interface TagItem {
  id: string;
  name: string;
  color: string;
  _count?: { contacts: number };
}

export default function TagsPage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TagItem | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [confirmDelete, setConfirmDelete] = useState<TagItem | null>(null);

  const { data, isLoading, error } = useQuery<{ tags: TagItem[] }>({
    queryKey: ["tags"],
    queryFn: async () => {
      const r = await fetch("/api/tags");
      const j = await r.json();
      if (!r.ok) throw new Error(j.message ?? j.error ?? "Failed to load tags");
      const payload = j?.data ?? j;
      return { tags: Array.isArray(payload?.tags) ? payload.tags : [] };
    },
    retry: 1,
  });
  const tags = data?.tags ?? [];

  function openCreate() {
    setEditing(null);
    setName("");
    setColor(PRESET_COLORS[0]);
    setModalOpen(true);
  }

  function openEdit(tag: TagItem) {
    setEditing(tag);
    setName(tag.name);
    setColor(tag.color);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const url = editing ? `/api/tags/${editing.id}` : "/api/tags";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), color }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? json.error ?? "Failed to save tag");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      closeModal();
      showToast(editing ? "Tag updated." : "Tag created.", "success");
    },
    onError: (err: Error) => showToast(err.message, "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (tag: TagItem) => {
      const res = await fetch(`/api/tags/${tag.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? json.error ?? "Failed to delete tag");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      setConfirmDelete(null);
      showToast("Tag deleted.", "success");
    },
    onError: (err: Error) => { setConfirmDelete(null); showToast(err.message, "error"); },
  });

  return (
    <div>
      <PageHeader
        title="Tag Master"
        description="Create and manage tags to organise your contacts."
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New tag
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {(error as Error).message}
        </div>
      ) : tags.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="No tags yet"
          description="Create tags to label and filter your contacts."
          action={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              New tag
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {tags.map((tag) => (
            <Card key={tag.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="truncate font-medium text-slate-900">{tag.name}</span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => openEdit(tag)}
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(tag)}
                    className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {(tag._count?.contacts ?? 0).toLocaleString()} contact{(tag._count?.contacts ?? 0) !== 1 ? "s" : ""}
              </p>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit modal */}
      <Modal open={modalOpen} onClose={closeModal} title={editing ? "Edit tag" : "New tag"}>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveMutation.mutate(); }}
              placeholder="e.g. VIP Customer"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              autoFocus
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium text-slate-600">Color</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  style={{ backgroundColor: c }}
                  className={`h-7 w-7 rounded-full transition-transform hover:scale-110 ${
                    color === c ? "ring-2 ring-offset-2 ring-slate-700 scale-110" : ""
                  }`}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!name.trim() || saveMutation.isPending}
            >
              {saveMutation.isPending ? "Saving…" : editing ? "Save changes" : "Create tag"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation */}
      {confirmDelete && (
        <Modal open onClose={() => setConfirmDelete(null)} title="Delete tag?">
          <p className="text-sm text-slate-600">
            Delete <strong>{confirmDelete.name}</strong>? It will be removed from all contacts.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => deleteMutation.mutate(confirmDelete)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
