"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useConversation, useConversations, useMarkConversationRead } from "@/hooks/useMessages";
import { ChatWindow } from "@/components/inbox/ChatWindow";
import { ContactPanel } from "@/components/inbox/ContactPanel";
import {
  ConversationList,
  type InboxAgent,
  type InboxConversation,
  type InboxMessage,
  type InboxTab,
} from "@/components/inbox/ConversationList";
import { cn } from "@/lib/utils";

/**
 * Every /api route is still a 501 stub, so the React Query hooks are expected to
 * reject. Nothing here trusts the payload shape: responses are unwrapped
 * defensively and each column falls back to a loading or empty view.
 */

/** Stable identity so ChatWindow's timeline memo doesn't recompute every render. */
const EMPTY: InboxMessage[] = [];

const STATUS_BY_TAB: Partial<Record<InboxTab, string>> = {
  open: "OPEN",
  assigned: "ASSIGNED",
  resolved: "RESOLVED",
};

export default function InboxPage() {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const userName = session?.user?.name;
  const userAvatar = session?.user?.avatar;
  const tenantId = session?.user?.tenantId;

  const queryClient = useQueryClient();
  const { mutate: markConversationRead } = useMarkConversationRead();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

  // SSE real-time subscription: invalidate conversations when a new message arrives.
  // EventSource auto-reconnects; on each (re)connect we refetch to catch any gap.
  // Falls back to the 30s poll in useConversations when SSE is unavailable.
  useEffect(() => {
    if (!tenantId) return;

    console.log("[inbox] SSE: opening /api/events tenantId=", tenantId);
    const es = new EventSource("/api/events");

    es.onopen = () => {
      console.log("[inbox] SSE: connected (readyState=OPEN)");
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      // Reconnect after timeout — also refresh the open conversation detail
      const openId = selectedIdRef.current;
      if (openId) void queryClient.invalidateQueries({ queryKey: ["conversations", openId] });
    };

    es.onmessage = (e) => {
      console.log("[inbox] SSE raw message:", e.data);
      try {
        const payload = JSON.parse(e.data as string);
        console.log("[inbox] SSE event:", payload?.event, payload);
        if (payload?.event === "new-message") {
          console.log("[inbox] SSE new-message → invalidating conversations conversationId=", payload?.conversationId);
          void queryClient.invalidateQueries({ queryKey: ["conversations"] });
          if (payload?.conversationId) {
            void queryClient.invalidateQueries({ queryKey: ["conversations", payload.conversationId] });
          }
        } else if (payload?.event === "status-update") {
          // Status changed (PENDING→SENT→DELIVERED→READ) — refresh the open conversation
          const openId = selectedIdRef.current;
          if (openId) void queryClient.invalidateQueries({ queryKey: ["conversations", openId] });
        }
      } catch (err) {
        console.warn("[inbox] SSE parse error:", err, "raw:", e.data);
      }
    };

    es.onerror = (err) => {
      console.error("[inbox] SSE error (will auto-reconnect):", err, "readyState=", es.readyState);
    };

    return () => {
      console.log("[inbox] SSE: closing connection");
      es.close();
    };
  }, [tenantId, queryClient]);

  const [tab, setTab] = useState<InboxTab>("all");
  const [search, setSearch] = useState("");
  /** Below xl the contact panel is a slide-over drawer rather than a third column. */
  const [panelOpen, setPanelOpen] = useState(false);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    setPanelOpen(false);
    // Do NOT auto-mark as read on open — agents need to see the unread badge until
    // they have actually replied. markConversationRead is called in handleSend instead.
  }, []);
  /** Optimistically "sent" messages, per conversation, cleared when server confirms. */
  const [outbox, setOutbox] = useState<Record<string, InboxMessage[]>>({});
  // Track the ID of the last server message per conversation. Comparing IDs (not array
  // length) correctly detects new messages when the server returns a fixed-size page.
  const lastServerMsgId = useRef<Record<string, string>>({});

  const handleSend = useCallback((conversationId: string, message: InboxMessage) => {
    setOutbox((prev) => ({
      ...prev,
      [conversationId]: [...(prev[conversationId] ?? []), message],
    }));
    // Sending a reply means the agent has read this conversation
    markConversationRead(conversationId);
  }, [markConversationRead]);

  const filters = useMemo(() => {
    const status = STATUS_BY_TAB[tab];
    if (status) return { status };
    if (tab === "mine" && userId) return { assigneeId: userId };
    return undefined;
  }, [tab, userId]);

  const {
    data: listData,
    isLoading: listLoading,
    isError: listError,
  } = useConversations(filters);
  const {
    data: detailData,
    isLoading: detailLoading,
    isError: detailError,
  } = useConversation(selectedId ?? "");

  // Only show the full-panel skeleton on the *first* load. A Pusher-driven refetch must not
  // blank the list/thread — that is what made the inbox look wiped after a new WhatsApp text.
  const listBusy = listLoading && !listData;
  const detailBusy = Boolean(selectedId) && detailLoading && !detailData;

  const all = useMemo(() => toArray<InboxConversation>(listData), [listData]);

  // The API may or may not honour the filter params yet, so narrow again here —
  // and search is client-side by design.
  const conversations = useMemo(() => {
    const status = STATUS_BY_TAB[tab];
    const query = search.trim().toLowerCase();

    return all
      .filter((c) => {
        if (status && c.status !== status) return false;
        if (tab === "mine" && userId) {
          const assignee = c.assignedTo?.id ?? c.assignedToId ?? null;
          if (assignee !== userId) return false;
        }
        if (!query) return true;
        return [c.contact?.name, c.contact?.phone, c.contact?.company, c.lastMessagePreview]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(query));
      })
      .sort((a, b) => time(b.lastMessageAt) - time(a.lastMessageAt));
  }, [all, tab, search, userId]);

  /** Prefer the detail payload; fall back to the list row so the header still renders. */
  const selected = useMemo<InboxConversation | null>(() => {
    if (!selectedId) return null;
    const detail = unwrap<InboxConversation>(detailData);
    const row = all.find((c) => c.id === selectedId) ?? null;
    if (detail?.id) return { ...row, ...detail };
    return row;
  }, [selectedId, detailData, all]);

  const messages = useMemo<InboxMessage[]>(() => {
    const detail = unwrap<InboxConversation>(detailData);
    return toArray<InboxMessage>(detail?.messages ?? unwrap<unknown>(detailData));
  }, [detailData]);

  // When the server delivers new messages, clear optimistic outbox entries.
  // Compare the LAST message ID (not array length) so this works correctly when
  // the server always returns a fixed page size (e.g. newest 50).
  useEffect(() => {
    if (!selectedId || messages.length === 0) return;
    const lastId = messages[messages.length - 1]?.id;
    if (!lastId) return;
    if (lastId !== lastServerMsgId.current[selectedId]) {
      lastServerMsgId.current[selectedId] = lastId;
      setOutbox((o) => (o[selectedId]?.length ? { ...o, [selectedId]: [] } : o));
    }
  }, [messages, selectedId]);

  /** No team endpoint exists yet — build the assignee options from what we have. */
  const agents = useMemo<InboxAgent[]>(() => {
    const byId = new Map<string, InboxAgent>();
    if (userId) {
      byId.set(userId, {
        id: userId,
        name: userName ? `${userName} (me)` : "Me",
        avatar: userAvatar,
      });
    }
    for (const c of all) {
      const agent = c.assignedTo;
      if (agent?.id && !byId.has(agent.id)) byId.set(agent.id, agent);
    }
    return [...byId.values()];
  }, [all, userId, userName, userAvatar]);

  return (
    // The dashboard <main> adds p-4/lg:p-6 and the topbar is h-16 — cancel both so
    // the inbox owns the full viewport and each column scrolls independently. dvh, not
    // vh, so the composer stays above the on-screen keyboard and mobile browser chrome.
    // Phones show the list OR the open thread; md+ shows both side by side.
    <div className="-m-4 flex h-[calc(100dvh-4rem)] overflow-hidden bg-white lg:-m-6">
      <ConversationList
        conversations={conversations}
        selectedId={selectedId}
        onSelect={handleSelect}
        isLoading={listBusy}
        isError={listError && !listData}
        search={search}
        onSearchChange={setSearch}
        tab={tab}
        onTabChange={setTab}
        className={cn("w-full shrink-0 md:w-80", selectedId && "hidden md:flex")}
      />

      {/* Keyed so composer/tab state resets cleanly when a different thread opens. */}
      <ChatWindow
        key={selectedId ?? "empty"}
        conversation={selected}
        messages={messages}
        localMessages={selectedId ? (outbox[selectedId] ?? EMPTY) : EMPTY}
        onSend={handleSend}
        isLoading={detailBusy}
        isError={detailError && !detailData}
        onBack={() => {
          setSelectedId(null);
          setPanelOpen(false);
        }}
        onShowContact={() => setPanelOpen(true)}
        className={cn("min-w-0 flex-1", selectedId ? "flex" : "hidden md:flex")}
      />

      {panelOpen && (
        <div
          aria-hidden
          onClick={() => setPanelOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/40 xl:hidden"
        />
      )}
      {/* One instance for both modes: a fixed drawer below xl, the static third column at xl+. */}
      <ContactPanel
        key={`panel-${selectedId ?? "empty"}`}
        conversation={selected}
        agents={agents}
        isLoading={detailBusy}
        onClose={() => setPanelOpen(false)}
        className={cn(
          "shrink-0 xl:static xl:z-auto xl:flex xl:w-72 xl:max-w-none xl:shadow-none",
          panelOpen
            ? "fixed inset-y-0 right-0 z-50 flex w-full max-w-sm shadow-2xl"
            : "hidden",
        )}
      />
    </div>
  );
}

// ─── Defensive payload access ─────────────────────────────────────────────────

/** Accepts `T`, `{ data: T }` or `{ success, data: T }` — anything else is null. */
function unwrap<T>(payload: unknown): T | null {
  if (!payload || typeof payload !== "object") return null;
  const data = (payload as { data?: unknown }).data;
  if (data && typeof data === "object") return data as T;
  return payload as T;
}

/** Accepts `T[]`, `{ data: T[] }` or `{ data: { items: T[] } }` — anything else is []. */
function toArray<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (!payload || typeof payload !== "object") return [];

  const data = (payload as { data?: unknown }).data;
  if (Array.isArray(data)) return data as T[];

  if (data && typeof data === "object") {
    const items = (data as { items?: unknown }).items;
    if (Array.isArray(items)) return items as T[];
  }
  return [];
}

function time(date?: string | Date | null) {
  if (!date) return 0;
  const t = new Date(date).getTime();
  return Number.isNaN(t) ? 0 : t;
}
