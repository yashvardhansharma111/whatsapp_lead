"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Search } from "lucide-react";
import { Button, Modal, Skeleton, inputClass } from "@/components/ui";
import { useToast } from "@/components/ui/toast";

interface LibraryItem {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  category: string;
  language: string;
  industry: string | null;
  useCount: number;
  spec: { body?: string };
}

/**
 * Ready-made templates to start from.
 *
 * Copying creates a real template in this account, because Meta approves a template per
 * account — nothing here is approved for anyone else, and the modal says so rather than
 * letting someone expect to send straight away.
 */
export function TemplateLibraryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: items = [], isLoading } = useQuery<LibraryItem[]>({
    queryKey: ["template-library", search],
    enabled: open,
    queryFn: async () => {
      const q = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";
      const res = await fetch(`/api/templates/library${q}`);
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Couldn't load the library");
      return (json?.data ?? json) as LibraryItem[];
    },
  });

  const copy = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/templates/library/${id}/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Couldn't copy that template");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      onClose();
      showToast("Copied as a draft. Edit it if you like, then submit it for approval.", "success");
    },
    onError: (e: Error) => showToast(e.message, "error"),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Template library"
      description="Start from a ready-made template. Meta approves templates per account, so copying makes your own draft to submit."
    >
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search the library"
            className={`${inputClass} pl-9`}
            autoFocus
          />
        </div>

        <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <BookOpen className="h-6 w-6 text-slate-300" />
              <p className="text-sm text-slate-500">
                {search ? "Nothing matches that." : "The library is empty for now."}
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {items.map((it) => (
                <li key={it.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">{it.displayName}</p>
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">
                        {it.category}
                        {it.industry && <> · {it.industry}</>}
                        {it.useCount > 0 && <> · used {it.useCount}×</>}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() => copy.mutate(it.id)}
                      disabled={copy.isPending}
                    >
                      Use this
                    </Button>
                  </div>
                  {(it.description || it.spec?.body) && (
                    <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-xs text-slate-600">
                      {it.description || it.spec?.body}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
