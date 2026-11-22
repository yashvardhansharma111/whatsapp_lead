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
import Link from "next/link";
import { useBusinesses } from "@/hooks/useBusinesses";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle,
  Loader2,
  Menu,
  Sparkles,
  StickyNote,
  Tag,
  Ticket as TicketIcon,
  Trash2,
  UserRound,
} from "lucide-react";
import { useResolveConversation, useSendMessage, useUpdateConversation } from "@/hooks/useMessages";
import { cn, formatDate } from "@/lib/utils";
import { MenuItem } from "./MenuItem";
import { LabelPicker } from "./LabelPicker";
import { contactTags, type InboxAgent, type InboxConversation } from "./ConversationList";

type View = "menu" | "note" | "labels" | "assign";

interface Note {
  id: string;
  content: string | null;
  createdAt: string;
  sentBy?: { name: string | null } | null;
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
  aiActive,
  onAiToggle,
  onShowContact,
}: {
  conversation: InboxConversation;
  agents?: InboxAgent[];
  /** The per-thread auto-reply switch, moved in from the header. */
  aiActive?: boolean;
  onAiToggle?: (next: boolean) => void;
  /** Below xl the contact panel is a drawer, and this is the way into it. */
  onShowContact?: () => void;
}) {
  const [open, setOpen] = useState(false);
  /**
   * Whether the workspace's AI is on at all.
   *
   * Three switches have to agree before a bot answers: the business's AI, its auto-reply,
   * and this chat's own toggle. Only the last one lives here, and it happily said
   * "Answering this chat" while the other two were off — so the chat claimed a reply was
   * coming, none came, and nothing on the screen explained why.
   */
  const { data: businessesData } = useBusinesses();
  const business = (businessesData?.data ?? []).find((b) => b.id === businessesData?.currentBusinessId);
  const workspaceAiOn = Boolean(business?.aiEnabled && business?.autoReply);
  const aiAnswering = Boolean(aiActive) && workspaceAiOn;

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
        aria-label="Chat actions — AI auto-reply, note, labels, assign, ticket"
        title="Chat actions"
        className={cn(
          "rounded-lg p-1.5 transition",
          open ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
        )}
      >
        <Menu className="h-4 w-4" />
        {/* The AI switch decides whether a bot answers your customer. Hidden behind a
            menu it could be on for days unnoticed, so its state stays on the trigger. */}
        {aiAnswering && (
          <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white" />
        )}
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
              {onAiToggle && (
                <label className="flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left transition hover:bg-slate-50">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-slate-800">AI auto-reply</span>
                    <span className="block text-xs text-slate-500">
                      {!workspaceAiOn ? (
                        <>
                          AI is off for this workspace, so nothing will reply.{" "}
                          <Link href="/ai-settings" className="font-medium text-emerald-700 underline underline-offset-2">
                            Turn it on
                          </Link>
                        </>
                      ) : aiActive ? (
                        "Answering this chat"
                      ) : (
                        "Off for this chat"
                      )}
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={Boolean(aiActive)}
                    onChange={(e) => onAiToggle(e.target.checked)}
                    aria-label="Toggle AI auto-reply for this conversation"
                    className="h-4 w-4 shrink-0 accent-emerald-600"
                  />
                </label>
              )}
              {onShowContact && (
                <div className="xl:hidden">
                  <MenuItem
                    icon={UserRound}
                    label="Contact details"
                    onClick={() => { close(); onShowContact(); }}
                  />
                </div>
              )}
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
  // The id waiting on a second press, rather than a browser confirm(): the menu is a
  // popover, and a modal dialog over it steals the click that dismisses it.
  const [confirming, setConfirming] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
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

  const remove = async (id: string) => {
    setRemoving(id);
    onError(null);
    try {
      await api(`/api/conversations/${conversation.id}/notes/${id}`, { method: "DELETE" });
      // Both, because a note is one row read two ways: it is listed here and it also
      // sits in the thread, so removing it from one place only would leave the other
      // showing something that no longer exists.
      await qc.invalidateQueries({ queryKey: ["conversation-notes", conversation.id] });
      await qc.invalidateQueries({ queryKey: ["conversations"] });
    } catch (e) {
      onError(e instanceof Error ? e.message : "Couldn't remove that note");
    } finally {
      setRemoving(null);
      setConfirming(null);
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
              <li key={n.id} className="group rounded-lg bg-amber-50/70 px-2.5 py-1.5">
                <div className="flex items-start gap-2">
                  <p className="min-w-0 flex-1 whitespace-pre-wrap wrap-anywhere text-[12px] leading-relaxed text-amber-950">
                    {n.content}
                  </p>
                  <button
                    type="button"
                    disabled={removing !== null}
                    onClick={() => (confirming === n.id ? void remove(n.id) : setConfirming(n.id))}
                    onBlur={() => setConfirming((c) => (c === n.id ? null : c))}
                    aria-label={confirming === n.id ? "Press again to remove this note" : "Remove this note"}
                    title={confirming === n.id ? "Press again to remove" : "Remove this note"}
                    className={cn(
                      "shrink-0 rounded p-1 transition disabled:opacity-50",
                      confirming === n.id
                        ? "bg-rose-600 text-white"
                        : "text-amber-700/60 hover:bg-amber-100 hover:text-rose-700",
                    )}
                  >
                    {removing === n.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
                <p className="mt-0.5 text-[10px] text-amber-700/80">
                  {confirming === n.id
                    ? "Press again to remove"
                    : `${n.sentBy?.name?.trim() || "Someone"} · ${formatDate(n.createdAt)}`}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
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

  const pick = (assignedToId: string | null) => {
    onError(null);
    update.mutate(
      { id: conversation.id, data: { assignedToId } },
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
