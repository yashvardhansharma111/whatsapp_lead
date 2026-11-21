"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Clock,
  HelpCircle,
  LayoutList,
  MessageSquare,
  Paperclip,
  Plus,
  Reply,
  Send,
  Smile,
  Sparkles,
  StickyNote,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { Avatar, Badge, Button, EmptyState, Skeleton, inputClass } from "@/components/ui";
import { CONVERSATION_STATUS_STYLE, cn, dayLabel } from "@/lib/utils";
import { ATTACHMENT_ACCEPT } from "@/lib/attachments";
import { useMarkConversationRead, useSendMessage, useSetConversationAiActive } from "@/hooks/useMessages";
import type { InteractivePayload } from "@/lib/validators/message";
import { useQuickReplies, type QuickReply } from "@/hooks/useQuickReplies";
import { contactName, type InboxAgent, type InboxConversation, type InboxMessage } from "./ConversationList";
import { FaqMenuPicker } from "./FaqMenuPicker";
import { ChatActionsMenu } from "./ChatActionsMenu";
import { MenuItem } from "./MenuItem";
import { AttachmentDropOverlay } from "./AttachmentDropOverlay";
import { AttachmentPreviewModal } from "./AttachmentPreviewModal";
import { TemplateComposer } from "./TemplateComposer";
import { MessageBubble } from "./message/MessageBubble";
import { CallButton } from "./CallButton";
import { useAttachmentComposer } from "./useAttachmentComposer";
import { useCallControls } from "@/components/calls/CallProvider";

// Lazy-load the picker so its ~400 KB data bundle only downloads when the Smile
// button is first clicked, not on every inbox load.
const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * The page remounts this with `key={conversationId}`, so all composer state is
 * naturally per-conversation — no reset effects needed. Optimistic sends live in
 * the react-query cache (useSendMessage), so they survive switching threads.
 */
export function ChatWindow({
  conversation,
  messages,
  isLoading,
  isError,
  onBack,
  onShowContact,
  agents = [],
  className,
}: {
  conversation: InboxConversation | null;
  messages: InboxMessage[];
  isLoading?: boolean;
  isError?: boolean;
  onBack?: () => void;
  /** Teammates this chat can be assigned to, for the header's "+" menu. */
  agents?: InboxAgent[];
  /** Opens the contact drawer — only rendered below xl, where the panel isn't a column. */
  onShowContact?: () => void;
  className?: string;
}) {
  const conversationId = conversation?.id ?? null;

  // Read, never held. `isAiActive` lives on the conversation row and reaches this component through
  // the React Query cache, so the switch reflects what is stored rather than what this component
  // last remembered. Copying it into `useState` was the bug: the inbox mounts this with
  // `key={selectedId}`, so that copy was discarded on every remount — a route change, a refresh, or
  // simply reopening the thread — and the switch fell back to whatever the initial render had seen.
  const aiActive = Boolean(conversation?.isAiActive);

  const [draft, setDraft] = useState("");
  const [isNote, setIsNote] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<InboxMessage | null>(null);
  const [showInteractive, setShowInteractive] = useState(false);
  const [interactiveType, setInteractiveType] = useState<"button" | "list">("button");
  const [interactiveBody, setInteractiveBody] = useState("");
  const [interactiveButtons, setInteractiveButtons] = useState<string[]>(["", ""]);
  const [interactiveListBtn, setInteractiveListBtn] = useState("Select an option");
  const [interactiveRows, setInteractiveRows] = useState<{title: string; description: string}[]>([{title: "", description: ""}]);

  // Quick replies expand from a "/shortcode" typed at the start of the composer. `qrDismissed`
  // exists so Escape can close the picker without also clearing what the agent has typed —
  // the draft still begins with "/", so without it the picker would immediately reopen.
  const [qrIndex, setQrIndex] = useState(0);
  const [qrDismissed, setQrDismissed] = useState(false);
  const quickRepliesQuery = useQuickReplies();
  const quickRepliesData = quickRepliesQuery.data;
  const quickReplies: QuickReply[] = useMemo(
    () => quickRepliesData?.data ?? [],
    [quickRepliesData],
  );

  const qrMatches = useMemo(() => {
    if (!draft.startsWith("/")) return [];
    const term = draft.slice(1).toLowerCase();
    // The whole draft is the search term, so a space means the agent has moved on to writing a
    // real message that merely happens to start with a slash.
    if (term.includes(" ")) return [];
    return quickReplies.filter((q) => q.shortcode.startsWith(term)).slice(0, 6);
  }, [draft, quickReplies]);

  const qrOpen = !qrDismissed && qrMatches.length > 0;

  const applyQuickReply = (reply: QuickReply) => {
    setDraft(reply.content);
    setQrDismissed(true);
    inputRef.current?.focus();
  };

  const fileRef = useRef<HTMLInputElement>(null);
  const callControls = useCallControls();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  // Close emoji picker on outside click
  useEffect(() => {
    if (!showEmoji) return;
    const handler = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setShowEmoji(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showEmoji]);

  // Same for the "+" menu, and Escape closes it — a popover that can only be dismissed
  // by hitting the button again is a trap on a phone.
  useEffect(() => {
    if (!showMore) return;
    const click = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setShowMore(false);
    };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setShowMore(false); };
    document.addEventListener("mousedown", click);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", click);
      document.removeEventListener("keydown", key);
    };
  }, [showMore]);

  const [isAiGenerating, setIsAiGenerating] = useState(false);
  /**
   * Documents the current AI draft was grounded in.
   *
   * Held only while the draft is in the composer. Once sent it is an ordinary
   * agent message — a human read it, edited it and chose to send it, so it is
   * theirs, and citing the knowledge base under it would be attributing their
   * words to a document.
   */
  const [aiSources, setAiSources] = useState<string[]>([]);
  const [showFaqMenu, setShowFaqMenu] = useState(false);
  const sendMessage = useSendMessage();
  const setAiActive = useSetConversationAiActive();
  const markRead = useMarkConversationRead();

  /**
   * Opening a thread is reading it.
   *
   * The server already zeroes the count when it serves the conversation, so the badge
   * was outliving the thing it counted: the row kept saying "1" until the agent happened
   * to reply, and clicking it again changed nothing. This patches the cached list to
   * match what the server has already done. Replying still marks read as well, for the
   * case where a message lands while the thread is open.
   */
  const markReadRef = useRef(markRead);
  useEffect(() => { markReadRef.current = markRead; }, [markRead]);
  // Once per conversation, whatever the payload says. The count is read from the detail
  // response, so a stale one there would otherwise keep this effect firing forever.
  const markedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!conversationId || markedRef.current === conversationId) return;
    markedRef.current = conversationId;
    markReadRef.current.mutate(conversationId);
  }, [conversationId]);

  /**
   * Hand the change to the mutation and nothing else.
   *
   * There is deliberately no local write here. The mutation patches the cached conversation
   * optimistically and rolls that patch back if the request fails, so the switch responds instantly
   * while the cache stays the one thing describing this conversation's state.
   */
  function handleAiToggle(next: boolean) {
    if (!conversationId) return;
    setAiActive.mutate({ id: conversationId, isAiActive: next });
  }

  // All attachment behaviour (drag-and-drop, file picker, clipboard paste, preview and the
  // shared upload → send pipeline) lives in this hook so the composer stays a thin shell.
  const attach = useAttachmentComposer({ conversationId, sendFn: sendMessage.mutateAsync });
  const queryClient = useQueryClient();

  // WhatsApp carries a typed message only for 24 hours after the customer last wrote.
  // The server works the window out; an older thread that predates the field is treated
  // as open, because guessing it shut would take away a composer that does work.
  const win = conversation?.serviceWindow;
  const windowShut = win ? !win.open : false;
  const windowReason = !win
    ? ""
    : !win.everReplied
      ? "They have never messaged you, so WhatsApp only allows an approved template first. Once they reply you can type freely for 24 hours."
      : `It is more than 24 hours since ${conversation?.contact?.name?.trim() || "they"} last replied, so WhatsApp only allows an approved template. Their reply opens the chat again for 24 hours.`;

  const timeline = useMemo(
    () => [...messages].sort((a, b) => msTime(a.createdAt) - msTime(b.createdAt)),
    [messages],
  );

  // Follow the conversation as it grows (and land at the bottom on first paint).
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [timeline.length]);

  if (!conversation) {
    return (
      <div className={cn("flex min-w-0 flex-col items-center justify-center bg-slate-50", className)}>
        <EmptyState
          icon={MessageSquare}
          title="Select a conversation"
          description="Pick a thread from the list to read the history and reply."
        />
      </div>
    );
  }

  const name = contactName(conversation);
  const status = conversation.status ?? "OPEN";

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content || !conversationId || sendMessage.isPending) return;
    setSendError(null);
    const replyToId = replyTo?.id;
    setDraft("");
    setAiSources([]);
    setShowEmoji(false);
    setReplyTo(null);

    try {
      await sendMessage.mutateAsync({ conversationId, content, type: "TEXT", isNote, replyToId });
      // Replying means the agent has read this conversation.
      markRead.mutate(conversationId);
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "Failed to send message");
    }
  }

  async function handleSendInteractive() {
    if (!conversationId || sendMessage.isPending) return;
    setSendError(null);

    const body = interactiveBody.trim();
    if (!body) { setSendError("Body text is required"); return; }

    let interactive: InteractivePayload;
    if (interactiveType === "button") {
      const validBtns = interactiveButtons.map((b, i) => b.trim()).filter(Boolean);
      if (validBtns.length === 0) { setSendError("Add at least one button"); return; }
      interactive = {
        type: "button",
        body: { text: body },
        action: {
          buttons: validBtns.map((title, i) => ({ type: "reply" as const, reply: { id: `btn_${i}`, title } })),
        },
      };
    } else {
      const validRows = interactiveRows.filter((r) => r.title.trim());
      if (validRows.length === 0) { setSendError("Add at least one list option"); return; }
      interactive = {
        type: "list",
        body: { text: body },
        action: {
          button: interactiveListBtn.trim() || "Select an option",
          sections: [{ rows: validRows.map((r, i) => ({ id: `row_${i}`, title: r.title.trim(), ...(r.description.trim() ? { description: r.description.trim() } : {}) })) }],
        },
      };
    }

    setShowInteractive(false);
    setInteractiveBody("");

    try {
      await sendMessage.mutateAsync({
        conversationId,
        type: "INTERACTIVE",
        content: body,
        interactive,
        replyToId: replyTo?.id,
      });
      markRead.mutate(conversationId);
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "Failed to send interactive message");
    }
    setInteractiveButtons(["", ""]);
    setInteractiveRows([{ title: "", description: "" }]);
    setReplyTo(null);
  }

  function insertEmoji(emoji: string) {
    setDraft((d) => d + emoji);
    setShowEmoji(false);
    inputRef.current?.focus();
  }

  async function handleAiSuggest() {
    if (!conversationId || isAiGenerating) return;
    setIsAiGenerating(true);
    setDraft("");
    setAiSources([]);

    try {
      const res = await fetch("/api/ai/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "AI reply failed");
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") break;
          try {
            const parsed = JSON.parse(payload) as {
              chunk?: string;
              error?: string;
              sources?: { name?: string }[];
            };
            if (parsed.error) throw new Error(parsed.error);
            // Arrives on its own frame ahead of the first token, so the agent can
            // see what the draft is grounded in while it is still being written.
            if (parsed.sources) {
              setAiSources(parsed.sources.map((s) => s?.name ?? "").filter(Boolean));
            }
            if (parsed.chunk) setDraft((d) => d + parsed.chunk);
          } catch {
            // ignore malformed SSE frames
          }
        }
      }

      inputRef.current?.focus();
    } catch (err) {
      setDraft(err instanceof Error ? `⚠️ ${err.message}` : "⚠️ AI reply failed");
    } finally {
      setIsAiGenerating(false);
    }
  }

  return (
    <div className={cn("flex min-w-0 flex-col bg-slate-50", className)}>
      {/* Header */}
      <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-3 py-2.5 lg:px-4">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to conversations"
            className="-ml-1.5 rounded-lg p-2.5 text-slate-500 hover:bg-slate-100 md:hidden"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}

        <Avatar name={name} src={conversation.contact?.avatarUrl} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
            <Badge className={cn("hidden sm:inline-flex", CONVERSATION_STATUS_STYLE[status])}>
              {String(status).toLowerCase()}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5">
            <p className="truncate text-xs text-slate-500">
              {conversation.contact?.phone ?? "No phone on file"}
            </p>
            {/* Which of your numbers this thread is on. Replies go back out from it,
                never from another, so it is worth seeing before typing. */}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* Only offered where calling is actually usable: the provider is absent outside
              the dashboard shell, and the contact needs a number to be reachable on. */}
          {callControls && conversation.contact?.id && (
            <CallButton
              contactId={conversation.contact.id}
              displayName={conversation.contact.name ?? conversation.contact.phone ?? undefined}
              controls={callControls}
            />
          )}
          {/* Note, labels, assign, ticket, resolve. These lived only in the panel on the
              right, which is a closed drawer below xl — so from the chat itself there was
              no way to do any of them. */}
          <ChatActionsMenu conversation={conversation} agents={agents} />
          <span className="hidden text-xs font-medium text-slate-600 sm:inline">AI Auto-Reply</span>
          <Sparkles
            className={cn("h-4 w-4 sm:hidden", aiActive ? "text-emerald-600" : "text-slate-400")}
          />
          <Switch
            checked={aiActive}
            onChange={handleAiToggle}
            label="Toggle AI auto-reply for this conversation"
          />
          {onShowContact && (
            <button
              type="button"
              onClick={onShowContact}
              aria-label="Show contact details"
              title="Contact details"
              className="-mr-1.5 rounded-lg p-2.5 text-slate-500 hover:bg-slate-100 xl:hidden"
            >
              <UserRound className="h-5 w-5" />
            </button>
          )}
        </div>
      </header>

      {/* Opted-out banner */}
      {conversation.contact?.optedOut && (
        <div className="flex items-center gap-2 border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs font-medium text-rose-700">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          This contact has opted out (sent STOP). Messages will not be delivered. They can re-subscribe by texting START.
        </div>
      )}

      {/* Messages */}
      <div
        className="scrollbar-slim min-h-0 flex-1 overflow-y-auto px-3 py-4 lg:px-6"
        // WhatsApp's own paper. The dotted grid read as a design canvas, which is the
        // wrong association for a page where the thing being read is a conversation.
        style={{ background: "#efeae2" }}
      >
        {isLoading ? (
          <MessageSkeleton />
        ) : isError && timeline.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <EmptyState
              icon={AlertCircle}
              title="Messages unavailable"
              description="We couldn't load this thread. It will fill in once the messages service is live."
            />
          </div>
        ) : timeline.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <EmptyState
              icon={MessageSquare}
              title="No messages yet"
              description={`Say hello to ${name} — your reply starts the thread.`}
            />
          </div>
        ) : (
          <ul className="space-y-1.5">
            {timeline.map((message, i) => {
              const prev = timeline[i - 1];
              const showDay = !prev || dayLabel(prev.createdAt) !== dayLabel(message.createdAt);
              const quotedMessage = message.replyToId
                ? timeline.find((m) => m.id === message.replyToId) ?? null
                : null;
              return (
                <li key={message.id}>
                  {showDay && (
                    <div className="my-4 flex justify-center">
                      <span className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-slate-500 shadow-sm ring-1 ring-slate-200">
                        {dayLabel(message.createdAt)}
                      </span>
                    </div>
                  )}
                  <MessageBubble
                    message={message}
                    quotedMessage={quotedMessage}
                    onReply={conversation.contact?.optedOut ? undefined : () => setReplyTo(message)}
                  />
                </li>
              );
            })}
          </ul>
        )}
        <div ref={bottomRef} />
      </div>

      {/* A chat WhatsApp will not carry a typed message to gets the template composer in
          place of the text box, not beside it — offering a box that cannot work is how
          an agent ends up watching a reply fail silently at Meta. */}
      {windowShut && conversationId ? (
        <TemplateComposer
          conversationId={conversationId}
          whatsappIntegrationId={conversation?.whatsappIntegrationId}
          reason={windowReason}
          onSent={() => {
            void queryClient.invalidateQueries({ queryKey: ["conversations", conversationId] });
          }}
        />
      ) : (

      /* Composer — `relative` so the drop overlay highlights only this region. */
      <div
        className="relative shrink-0 border-t border-slate-200 bg-white px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 lg:px-4"
        onDragEnter={attach.dragHandlers.onDragEnter}
        onDragOver={attach.dragHandlers.onDragOver}
        onDragLeave={attach.dragHandlers.onDragLeave}
        onDrop={attach.dragHandlers.onDrop}
      >
        <AttachmentDropOverlay visible={attach.isDragging} />

        {/* Reply-to strip */}
        {replyTo && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <Reply className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-emerald-700">
                {replyTo.direction === "OUTBOUND" ? "Replying to yourself" : "Replying to customer"}
              </p>
              <p className="truncate text-xs text-slate-500">
                {replyTo.content || (replyTo.type === "INTERACTIVE" ? "Interactive message" : `[${replyTo.type?.toLowerCase()}]`)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              aria-label="Cancel reply"
              className="-my-1 rounded p-2 text-slate-400 hover:text-slate-600 sm:my-0 sm:p-0.5"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Interactive message composer */}
        {showInteractive && (
          // Capped on phones so a long button/list form can't push the input off a short viewport.
          <div className="scrollbar-slim mb-3 max-h-[45dvh] space-y-3 overflow-y-auto rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 sm:max-h-none sm:overflow-visible">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-emerald-800">Interactive Message</p>
              <button type="button" onClick={() => setShowInteractive(false)} aria-label="Close interactive message" className="-my-1 rounded p-2 text-slate-400 hover:text-slate-600 sm:my-0 sm:p-0.5">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex gap-2">
              {(["button", "list"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setInteractiveType(t)}
                  className={cn("rounded-md px-2.5 py-1 text-xs font-medium transition capitalize",
                    interactiveType === t ? "bg-emerald-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                  )}>{t}</button>
              ))}
            </div>
            <textarea
              rows={2}
              value={interactiveBody}
              onChange={(e) => setInteractiveBody(e.target.value)}
              placeholder="Body text sent to the customer…"
              className={cn(inputClass, "resize-none text-base sm:text-sm")}
            />
            {interactiveType === "button" ? (
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium text-slate-500">Buttons (max 3, max 20 chars each)</p>
                {interactiveButtons.map((btn, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <input
                      value={btn}
                      maxLength={20}
                      onChange={(e) => setInteractiveButtons((prev) => prev.map((b, j) => j === i ? e.target.value : b))}
                      placeholder={`Button ${i + 1}`}
                      className={cn(inputClass, "flex-1 py-1.5 text-base sm:text-sm")}
                    />
                    {interactiveButtons.length > 1 && (
                      <button type="button" onClick={() => setInteractiveButtons((prev) => prev.filter((_, j) => j !== i))}
                        className="rounded p-1 text-slate-400 hover:text-rose-500">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                {interactiveButtons.length < 3 && (
                  <button type="button" onClick={() => setInteractiveButtons((prev) => [...prev, ""])}
                    className="flex items-center gap-1 text-xs text-emerald-700 hover:underline">
                    <Plus className="h-3 w-3" /> Add button
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium text-slate-500">Menu button label</p>
                <input value={interactiveListBtn} maxLength={20} onChange={(e) => setInteractiveListBtn(e.target.value)}
                  placeholder="Select an option" className={cn(inputClass, "py-1.5 text-base sm:text-sm")} />
                <p className="text-[11px] font-medium text-slate-500">List options</p>
                {interactiveRows.map((row, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <div className="flex-1 space-y-1">
                      <input value={row.title} maxLength={24} onChange={(e) => setInteractiveRows((prev) => prev.map((r, j) => j === i ? {...r, title: e.target.value} : r))}
                        placeholder={`Option ${i + 1} title`} className={cn(inputClass, "py-1.5 text-base sm:text-sm")} />
                      <input value={row.description} maxLength={72} onChange={(e) => setInteractiveRows((prev) => prev.map((r, j) => j === i ? {...r, description: e.target.value} : r))}
                        placeholder="Description (optional)" className={cn(inputClass, "py-1.5 text-base sm:text-sm")} />
                    </div>
                    {interactiveRows.length > 1 && (
                      <button type="button" onClick={() => setInteractiveRows((prev) => prev.filter((_, j) => j !== i))}
                        className="mt-1 rounded p-1 text-slate-400 hover:text-rose-500">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                {interactiveRows.length < 10 && (
                  <button type="button" onClick={() => setInteractiveRows((prev) => [...prev, {title: "", description: ""}])}
                    className="flex items-center gap-1 text-xs text-emerald-700 hover:underline">
                    <Plus className="h-3 w-3" /> Add option
                  </button>
                )}
              </div>
            )}
            <Button size="sm" onClick={handleSendInteractive} disabled={sendMessage.isPending || !interactiveBody.trim()}>
              {sendMessage.isPending ? <Clock className="h-3.5 w-3.5 animate-pulse" /> : <Send className="h-3.5 w-3.5" />}
              Send interactive
            </Button>
          </div>
        )}

        {/* Shown only while writing a note. The toggle itself moved into the "+" menu, but
            which mode you are in cannot live behind a menu — it decides whether what you
            type reaches the customer. */}
        {isNote && (
          <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-amber-50 px-2.5 py-1.5 ring-1 ring-inset ring-amber-200">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-900">
              <StickyNote className="h-3.5 w-3.5" />
              Internal note
            </span>
            <span className="text-[11px] text-amber-700">
              Only your team sees this — it is not sent to WhatsApp.
            </span>
            <button
              type="button"
              onClick={() => setIsNote(false)}
              className="ml-auto rounded px-1.5 py-0.5 text-[11px] font-medium text-amber-800 underline underline-offset-2 transition hover:bg-amber-100"
            >
              Write a message instead
            </button>
          </div>
        )}

        {/* Five tool icons + input + send don't fit a 360px row, so phones put the tools on
            their own line above the input; sm+ keeps the single row. */}
        <form onSubmit={handleSend} className="relative flex flex-wrap items-end gap-2 sm:flex-nowrap">
          <div className="relative flex w-full shrink-0 items-center gap-0.5 sm:w-auto">
            <input
              ref={fileRef}
              type="file"
              multiple
              accept={ATTACHMENT_ACCEPT}
              className="hidden"
              onChange={(e) => {
                attach.addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            {/* One "+" instead of five icons. The row could not hold them all on a phone,
                so the tools were wrapping onto a line of their own above the input and
                taking a third of the composer. Emoji stays out — it is used mid-sentence
                and belongs next to the text. */}
            <div ref={moreRef} className="relative">
              <ComposerIcon
                icon={Plus}
                label="More — attach, AI reply, FAQ menu, buttons, note"
                active={showMore}
                onClick={() => setShowMore((v) => !v)}
              />
              {showMore && (
                <div
                  role="menu"
                  className="absolute bottom-11 left-0 z-30 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
                >
                  <MenuItem
                    icon={Paperclip}
                    label="Attach a file"
                    onClick={() => { setShowMore(false); fileRef.current?.click(); }}
                  />
                  <MenuItem
                    icon={Sparkles}
                    label={isAiGenerating ? "Generating…" : "AI reply"}
                    hint="Drafts from this chat"
                    tone="emerald"
                    disabled={isAiGenerating}
                    onClick={() => { setShowMore(false); void handleAiSuggest(); }}
                  />
                  <MenuItem
                    icon={HelpCircle}
                    label="FAQ menu"
                    hint="Send a list of common questions"
                    tone="emerald"
                    onClick={() => { setShowMore(false); setShowFaqMenu(true); }}
                  />
                  <MenuItem
                    icon={LayoutList}
                    label="Buttons or list"
                    hint="An interactive message"
                    tone="emerald"
                    onClick={() => { setShowMore(false); setShowInteractive(true); }}
                  />
                  <div className="my-1 border-t border-slate-100" />
                  <MenuItem
                    icon={StickyNote}
                    label={isNote ? "Write a message instead" : "Internal note"}
                    hint={isNote ? undefined : "Only your team sees it"}
                    tone="amber"
                    onClick={() => { setShowMore(false); setIsNote((v) => !v); }}
                  />
                </div>
              )}
            </div>
            <ComposerIcon
              icon={Smile}
              label="Insert emoji"
              active={showEmoji}
              onClick={() => setShowEmoji((v) => !v)}
            />
            {showFaqMenu && conversationId && (
              <FaqMenuPicker
                conversationId={conversationId}
                onClose={() => setShowFaqMenu(false)}
              />
            )}
            {showEmoji && (
              <div ref={emojiRef} className="absolute bottom-11 left-0 z-30">
                <EmojiPicker
                  onEmojiClick={(e) => { insertEmoji(e.emoji); setShowEmoji(false); }}
                  lazyLoadEmojis
                  skinTonesDisabled
                  searchPlaceholder="Search emoji…"
                  height={380}
                  width={320}
                />
              </div>
            )}
          </div>

          {qrOpen && (
            <div className="absolute bottom-14 left-3 right-3 z-20 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
              <p className="border-b border-slate-100 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                Quick replies
              </p>
              {qrMatches.map((reply, index) => (
                <button
                  key={reply.id}
                  type="button"
                  // onMouseDown, not onClick: the input blurs before a click lands, and the blur
                  // handler closes the picker — the button would be gone before it ever fired.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    applyQuickReply(reply);
                  }}
                  onMouseEnter={() => setQrIndex(index)}
                  className={cn(
                    "flex w-full flex-col gap-0.5 px-3 py-2 text-left",
                    index === qrIndex ? "bg-emerald-50" : "hover:bg-slate-50",
                  )}
                >
                  <span className="text-xs font-semibold text-emerald-700">/{reply.shortcode}</span>
                  <span className="line-clamp-2 text-xs text-slate-600">{reply.content}</span>
                </button>
              ))}
            </div>
          )}

          {aiSources.length > 0 && draft && (
            <p className="mb-1.5 flex w-full items-center gap-1.5 text-[11px] text-slate-500 sm:w-auto">
              <BookOpen className="h-3 w-3 shrink-0 text-emerald-600" />
              Drafted from {aiSources.join(", ")}
            </p>
          )}

          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setSendError(null);
              setQrDismissed(false);
              setQrIndex(0);
            }}
            onKeyDown={(e) => {
              if (!qrOpen) return;
              // While the picker is open it owns these keys — Enter in particular, which would
              // otherwise submit the form and send the raw "/shortcode" as the message.
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setQrIndex((i) => (i + 1) % qrMatches.length);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setQrIndex((i) => (i - 1 + qrMatches.length) % qrMatches.length);
              } else if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                applyQuickReply(qrMatches[qrIndex] ?? qrMatches[0]);
              } else if (e.key === "Escape") {
                e.preventDefault();
                setQrDismissed(true);
              }
            }}
            onBlur={() => setQrDismissed(true)}
            onPaste={attach.onPaste}
            placeholder={isNote ? "Write an internal note…" : "Type a message"}
            aria-label={isNote ? "Internal note" : "Message"}
            className={cn(
              "min-w-0 flex-1 rounded-full border px-4 py-2.5 text-base text-slate-900 sm:text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2",
              isNote
                ? "border-amber-300 bg-amber-50 placeholder:text-amber-600/70 focus:border-amber-400 focus:ring-amber-500/20"
                : "border-slate-200 bg-slate-50 focus:border-emerald-500 focus:bg-white focus:ring-emerald-500/20",
            )}
          />

          <Button
            type="submit"
            disabled={!draft.trim() || sendMessage.isPending}
            aria-label="Send message"
            className={cn(
              "h-10 w-10 shrink-0 rounded-full p-0",
              isNote && "bg-amber-500 hover:bg-amber-600",
            )}
          >
            {sendMessage.isPending ? (
              <Clock className="h-4 w-4 animate-pulse" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>

        {sendError && (
          <div className="mt-2 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" aria-hidden />
            <span className="flex-1 leading-snug">{sendError}</span>
            <button
              type="button"
              onClick={() => setSendError(null)}
              className="shrink-0 text-rose-400 hover:text-rose-600"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
      )}

      {/* Review step for dropped / picked / pasted files. Renders only when files are staged. */}
      <AttachmentPreviewModal
        items={attach.items}
        caption={attach.caption}
        onCaptionChange={attach.setCaption}
        isNote={isNote}
        isUploading={attach.isUploading}
        progress={attach.progress}
        uploadError={attach.uploadError}
        errors={attach.errors}
        onRemove={attach.removeItem}
        onMove={attach.moveItem}
        onCancelUpload={attach.cancelUpload}
        onDiscard={attach.clear}
        onSend={() => attach.send({ isNote })}
      />
    </div>
  );
}

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600",
        checked ? "bg-emerald-600" : "bg-slate-300",
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 rounded-full bg-white shadow transition",
          checked ? "translate-x-4.5" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

/** A row in the composer's "+" menu: what it does, and a line on why you would. */

function ComposerIcon({
  icon: Icon,
  label,
  onClick,
  active,
  disabled,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      disabled={disabled}
      className={cn(
        "rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600",
        active && "bg-slate-100 text-slate-700",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}

function MessageSkeleton() {
  const widths = ["w-40", "w-56", "w-32", "w-64", "w-44"];
  return (
    <div className="space-y-4">
      {widths.map((w, i) => (
        <div key={i} className={cn("flex", i % 2 ? "justify-end" : "justify-start")}>
          <Skeleton className={cn("h-12 rounded-2xl", w)} />
        </div>
      ))}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function msTime(date?: string | Date | null) {
  if (!date) return 0;
  const t = new Date(date).getTime();
  return Number.isNaN(t) ? 0 : t;
}
