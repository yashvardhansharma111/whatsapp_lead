"use client";

// Everything you can do to a chat, from the chat.
//
// These actions existed, but only in the panel on the right — which is a drawer below
// xl and closed by default, so on a laptop or a phone the chat itself offered nothing
// but typing. Leaving a note meant finding a toggle inside the composer's own menu, and
// labelling the contact could not be done from the inbox at all: the panel listed the
// labels and gave no way to add one.
//
// So they sit behind a "+" next to the AI switch, where the chat is.

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle,
  Loader2,
  Plus,
  StickyNote,
  Tag,
  Ticket as TicketIcon,
  UserRound,
} from "lucide-react";
import { useResolveConversation, useSendMessage, useUpdateConversation } from "@/hooks/useMessages";
import { cn, formatDate } from "@/lib/utils";
import { MenuItem } from "./MenuItem";
import { contactTags, type InboxAgent, type InboxConversation } from "./ConversationList";

type View = "menu" | "note" | "labels" | "assign";

interface Note {
  id: string;
  content: string | null;
  createdAt: string;
  sentBy?: { name: string | null } | null;
}

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

export function ChatActionsMenu({
  conversation,
  agents = [],
}: {
  conversation: InboxConversation;
  agents?: InboxAgent[];
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("menu");
  const [error, setError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const resolve = useResolveConversation();
  const update = useUpdateConversation();
  const qc = useQueryClient();

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      // Back to the menu first — one Escape should not throw away a half-written note.
      if (e.key !== "Escape") return;
      setView((v) => (v === "menu" ? v : "menu"));
      if (view === "menu") setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open, view]);

  const close = () => {
    setOpen(false);
    setView("menu");
    setError(null);
  };

  const resolved = conversation.status === "RESOLVED";
  const noteSummary = useNoteSummary(conversation.id, open);

  const ticket = useMutation({
    mutationFn: () =>
      api("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: conversation.id,
          subject: `Chat with ${conversation.contact?.name?.trim() || conversation.contact?.phone || "a contact"}`,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversation-tickets", conversation.id] });
      close();
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Chat actions — note, labels, assign, ticket"
        title="Note, labels, assign, ticket"
        className={cn(
          "rounded-lg p-1.5 transition",
          open ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
        )}
      >
        <Plus className="h-4 w-4" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-10 z-40 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
        >
          {error && (
            <p className="border-b border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>
          )}

          {view !== "menu" && (
            <button
              type="button"
              onClick={() => { setView("menu"); setError(null); }}
              className="flex w-full items-center gap-1.5 border-b border-slate-100 px-3 py-2 text-left text-xs font-medium text-slate-500 transition hover:bg-slate-50"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
          )}

          {view === "menu" && (
            <div className="py-1">
              <MenuItem
                icon={StickyNote}
                label="Add a note"
                hint={
                  noteSummary
                    ? `${noteSummary} on this chat · only your team sees them`
                    : "Only your team sees it"
                }
                tone="amber"
                onClick={() => setView("note")}
              />
              <MenuItem
                icon={Tag}
                label="Labels"
                hint={labelHint(conversation)}
                tone="emerald"
                onClick={() => setView("labels")}
              />
              <MenuItem
                icon={UserRound}
                label="Assign to"
                hint={conversation.assignedTo?.name?.trim() || "Nobody yet"}
                onClick={() => setView("assign")}
              />
              <div className="my-1 border-t border-slate-100" />
              <MenuItem
                icon={TicketIcon}
                label={ticket.isPending ? "Raising…" : "Raise a ticket"}
                hint="Tracks this chat as a support case"
                disabled={ticket.isPending}
                onClick={() => { setError(null); ticket.mutate(); }}
              />
              <MenuItem
                icon={CheckCircle}
                label={resolved ? "Reopen the chat" : "Mark resolved"}
                tone={resolved ? "slate" : "emerald"}
                disabled={resolve.isPending || update.isPending}
                onClick={() => {
                  setError(null);
                  const done = { onSuccess: () => close(), onError: (e: Error) => setError(e.message) };
                  if (resolved) {
                    update.mutate({ id: conversation.id, data: { status: "OPEN" } }, done);
                  } else {
                    resolve.mutate(conversation.id, done);
                  }
                }}
              />
            </div>
          )}

          {view === "note" && <NoteComposer conversation={conversation} onError={setError} />}
          {view === "labels" && <LabelPicker conversation={conversation} onError={setError} />}
          {view === "assign" && (
            <AssignPicker
              conversation={conversation}
              agents={agents}
              onPicked={close}
              onError={setError}
            />
          )}
        </div>
      )}
    </div>
  );
}

/** How many notes this chat has, so the menu can say so before you open it. */
function useNoteSummary(conversationId: string, enabled: boolean) {
  const { data } = useQuery({
    queryKey: ["conversation-notes", conversationId],
    queryFn: () => api<{ notes: Note[] }>(`/api/conversations/${conversationId}/notes`).then((r) => r.notes ?? []),
    enabled,
  });
  if (!data) return null;
  return `${data.length} note${data.length === 1 ? "" : "s"}`;
}

function labelHint(conversation: InboxConversation): string {
  const tags = contactTags(conversation.contact);
  if (!tags.length) return "None yet";
  return tags.map((t) => t.name).join(", ");
}

/**
 * Write a note, and see the ones already here.
 *
 * It stays open after saving with the box cleared, because notes come in several — a
 * call back, then what was agreed, then who is handling it — and closing after each one
 * made writing the second feel like starting over.
 */
function NoteComposer({
  conversation,
  onError,
}: {
  conversation: InboxConversation;
  onError: (m: string | null) => void;
}) {
  const [text, setText] = useState("");
  const qc = useQueryClient();
  const send = useSendMessage();
  const [saving, setSaving] = useState(false);
  const boxRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { boxRef.current?.focus(); }, []);

  const { data: notes = [] } = useQuery({
    queryKey: ["conversation-notes", conversation.id],
    queryFn: () =>
      api<{ notes: Note[] }>(`/api/conversations/${conversation.id}/notes`).then((r) => r.notes ?? []),
  });

  const save = async () => {
    const content = text.trim();
    if (!content || saving) return;
    setSaving(true);
    onError(null);
    try {
      await send.mutateAsync({ conversationId: conversation.id, content, type: "TEXT", isNote: true });
      setText("");
      await qc.invalidateQueries({ queryKey: ["conversation-notes", conversation.id] });
      boxRef.current?.focus();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Couldn't save that note");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-3">
      <textarea
        ref={boxRef}
        id="chat-note"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void save(); }
        }}
        rows={3}
        placeholder="What should the team know?"
        className="w-full resize-none rounded-lg border border-amber-200 bg-amber-50/60 px-2.5 py-2 text-[13px] text-amber-950 outline-none transition placeholder:text-amber-700/50 focus:border-amber-400"
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[11px] text-slate-400">Never sent to WhatsApp</span>
        <button
          type="button"
          onClick={() => void save()}
          disabled={!text.trim() || saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-amber-600 disabled:opacity-50"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Save note
        </button>
      </div>

      {notes.length > 0 && (
        <div className="mt-3 border-t border-slate-100 pt-2">
          <p className="mb-1.5 text-[11px] text-slate-400">
            {notes.length} note{notes.length === 1 ? "" : "s"} · newest first
          </p>
          <ul className="scrollbar-slim max-h-44 space-y-1.5 overflow-y-auto">
            {notes.map((n) => (
              <li key={n.id} className="rounded-lg bg-amber-50/70 px-2.5 py-1.5">
                <p className="whitespace-pre-wrap wrap-anywhere text-[12px] leading-relaxed text-amber-950">
                  {n.content}
                </p>
                <p className="mt-0.5 text-[10px] text-amber-700/80">
                  {n.sentBy?.name?.trim() || "Someone"} · {formatDate(n.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Put labels on the contact, or make one on the spot.
 *
 * The right-hand panel listed a contact's labels and stopped there, so labelling
 * someone from the inbox meant leaving it for the Contacts screen. Labels are set by
 * name, which is also how the Contacts screen sets them.
 */
function LabelPicker({
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

function AssignPicker({
  conversation,
  agents,
  onPicked,
  onError,
}: {
  conversation: InboxConversation;
  agents: InboxAgent[];
  onPicked: () => void;
  onError: (m: string | null) => void;
}) {
  const update = useUpdateConversation();
  const current = conversation.assignedTo?.id ?? conversation.assignedToId ?? "";

  const pick = (assigneeId: string | null) => {
    onError(null);
    update.mutate(
      { id: conversation.id, data: { assigneeId } },
      { onSuccess: onPicked, onError: (e: Error) => onError(e.message) },
    );
  };

  if (!agents.length) {
    return <p className="px-3 py-4 text-xs text-slate-500">No teammates to assign this to yet.</p>;
  }

  return (
    <ul className="scrollbar-slim max-h-64 overflow-y-auto py-1">
      <li>
        <button
          type="button"
          disabled={update.isPending}
          onClick={() => pick(null)}
          className={cn(
            "w-full px-3 py-2 text-left text-[13px] transition hover:bg-slate-50 disabled:opacity-60",
            !current ? "font-medium text-slate-900" : "text-slate-600",
          )}
        >
          Unassigned
        </button>
      </li>
      {agents.map((a) => (
        <li key={a.id}>
          <button
            type="button"
            disabled={update.isPending}
            onClick={() => pick(a.id)}
            className={cn(
              "w-full truncate px-3 py-2 text-left text-[13px] transition hover:bg-slate-50 disabled:opacity-60",
              current === a.id ? "font-medium text-slate-900" : "text-slate-600",
            )}
          >
            {a.name?.trim() || "Teammate"}
          </button>
        </li>
      ))}
    </ul>
  );
}
