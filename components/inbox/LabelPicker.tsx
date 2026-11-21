"use client";

// Putting labels on a contact, from wherever the contact is in front of you.
//
// It lived inside the chat's actions menu, which meant the right-hand panel could list
// a contact's labels and offer no way to change them — the one place someone reads them
// is the one place they could not be edited.

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { contactTags, type InboxConversation } from "./ConversationList";

interface LabelRow {
  id: string;
  name: string;
  color?: string | null;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? "That did not work");
  return ((json as { data?: unknown }).data ?? json) as T;
}

/**
 * Put labels on the contact, or make one on the spot.
 *
 * The right-hand panel listed a contact's labels and stopped there, so labelling
 * someone from the inbox meant leaving it for the Contacts screen. Labels are set by
 * name, which is also how the Contacts screen sets them.
 */
export function LabelPicker({
  conversation,
  onError,
}: {
  conversation: InboxConversation;
  onError: (m: string | null) => void;
}) {
  const qc = useQueryClient();
  const contactId = conversation.contact?.id ?? null;
  const [fresh, setFresh] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const { data: labels = [], isLoading } = useQuery({
    queryKey: ["tags"],
    queryFn: () => api<{ tags: LabelRow[] }>("/api/tags").then((r) => r.tags ?? []),
  });

  const on = new Set(contactTags(conversation.contact).map((t) => t.name));

  const write = async (names: string[], marker: string) => {
    if (!contactId) return;
    setBusy(marker);
    onError(null);
    try {
      await api(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: names }),
      });
      await qc.invalidateQueries({ queryKey: ["conversations"] });
    } catch (e) {
      onError(e instanceof Error ? e.message : "Couldn't change the labels");
    } finally {
      setBusy(null);
    }
  };

  const toggle = (name: string) =>
    write(on.has(name) ? [...on].filter((n) => n !== name) : [...on, name], name);

  const create = async () => {
    const name = fresh.trim();
    if (!name) return;
    setBusy(name);
    onError(null);
    try {
      await api("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color: "#6366f1" }),
      });
      await qc.invalidateQueries({ queryKey: ["tags"] });
      setFresh("");
      await write([...on, name], name);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Couldn't create that label");
      setBusy(null);
    }
  };

  if (!contactId) {
    return <p className="px-3 py-4 text-xs text-slate-500">This chat has no contact to label.</p>;
  }

  return (
    <div className="p-3">
      {isLoading ? (
        <p className="py-3 text-xs text-slate-400">Loading labels…</p>
      ) : labels.length === 0 ? (
        <p className="pb-2 text-xs text-slate-500">No labels yet. Make the first one below.</p>
      ) : (
        <ul className="scrollbar-slim max-h-56 space-y-0.5 overflow-y-auto">
          {labels.map((l) => {
            const active = on.has(l.name);
            return (
              <li key={l.id}>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void toggle(l.name)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition disabled:opacity-60",
                    active ? "bg-emerald-50 text-emerald-900" : "text-slate-700 hover:bg-slate-50",
                  )}
                >
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-inset ring-black/10"
                    style={{ backgroundColor: l.color ?? "#6366f1" }}
                  />
                  <span className="min-w-0 flex-1 truncate">{l.name}</span>
                  {busy === l.name ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-slate-400" />
                  ) : active ? (
                    <CheckCircle className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-2 flex gap-1.5 border-t border-slate-100 pt-2">
        <input
          id="chat-new-label"
          value={fresh}
          onChange={(e) => setFresh(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void create(); } }}
          placeholder="New label…"
          className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[13px] outline-none transition focus:border-slate-400"
        />
        <button
          type="button"
          onClick={() => void create()}
          disabled={!fresh.trim() || busy !== null}
          className="shrink-0 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </div>
  );
}
