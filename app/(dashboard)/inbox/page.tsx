"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useConversation, useConversations } from "@/hooks/useMessages";
import { useInboxRealtime } from "@/hooks/useInboxRealtime";
import { useNumberFilter } from "@/hooks/useWhatsAppNumbers";
import { useAssignableAgents } from "@/hooks/useAgents";
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
 * The list and the open thread come from react-query; the socket keeps both caches
 * current (useInboxRealtime). Payloads are still unwrapped defensively so a
 * half-populated row renders rather than crashing a column.
 */

const STATUS_BY_TAB: Partial<Record<InboxTab, string>> = {
  open: "OPEN",
  assigned: "ASSIGNED",
  resolved: "RESOLVED",
};

export default function InboxPage() {
  return (
    <Suspense>
      <InboxPageInner />
    </Suspense>
  );
}

function InboxPageInner() {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const userName = session?.user?.name;
  const userAvatar = session?.user?.avatar;

  useInboxRealtime();

  // `/inbox?c=<id>` (notification clicks) opens that thread, including when the
  // param changes while the page is already mounted.
  const linkedId = useSearchParams().get("c");
  const [selectedId, setSelectedId] = useState<string | null>(linkedId);
  const [seenLinkedId, setSeenLinkedId] = useState(linkedId);
  if (linkedId !== seenLinkedId) {
    setSeenLinkedId(linkedId);
    if (linkedId) setSelectedId(linkedId);
  }
  const [tab, setTab] = useState<InboxTab>("all");
  const [search, setSearch] = useState("");
  // Debounced because the term is part of the query key: typing eight characters
  // unfiltered would mint eight cache entries and eight requests.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  /** Empty means every connected number. Only offered when more than one exists. */
  // Remembered per browser: picking a number and losing it on reload is worse than
  // never having offered the choice.
  const { numberId } = useNumberFilter();
  /** Below xl the contact panel is a slide-over drawer rather than a third column. */
  const [panelOpen, setPanelOpen] = useState(false);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    setPanelOpen(false);
    // Do NOT auto-mark as read on open — agents need to see the unread badge until
    // they have actually replied. ChatWindow marks it read after a successful send.
  }, []);

  // Every narrowing the server understands goes to the server. The list used to ask for
  // a page and then filter it again here, so a tab or a search only ever looked at the
  // rows already loaded — correct on a quiet workspace, quietly wrong on a busy one.
  const filters = useMemo(() => ({
    ...(STATUS_BY_TAB[tab] ? { status: STATUS_BY_TAB[tab] } : {}),
    ...(tab === "ai" ? { hasAiReply: true } : {}),
    ...(numberId ? { whatsappIntegrationId: numberId } : {}),
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    limit: 100,
  }), [tab, numberId, debouncedSearch]);

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

  // Only show the full-panel skeleton on the *first* load. A background refetch must not
  // blank the list/thread — that is what made the inbox look wiped after a new WhatsApp text.
  const listBusy = listLoading && !listData;
  const detailBusy = Boolean(selectedId) && detailLoading && !detailData;

  const all = useMemo(() => toArray<InboxConversation>(listData), [listData]);

  const conversations = useMemo(
    () => [...all].sort((a, b) => time(b.lastMessageAt) - time(a.lastMessageAt)),
    [all],
  );

  /** Prefer the detail payload; fall back to the list row so the header still renders. */
  const selected = useMemo<InboxConversation | null>(() => {
    if (!selectedId) return null;
    const detail = unwrap<InboxConversation>(detailData);
    const row = all.find((c) => c.id === selectedId) ?? null;
    if (detail?.id) return { ...row, ...detail };
    return row;
  }, [selectedId, detailData, all]);

  /**
   * A thread on another number is not shown here.
   *
   * A thread belongs to the number the customer wrote to, which need not be the one
   * picked in the navbar. Switching numbers filtered the list but left whatever was
   * open still open, so the screen showed a conversation that was no longer in the list
   * beside it — and the composer then refused to send, correctly, naming a number
   * nobody had chosen.
   *
   * Derived rather than cleared on a change: the selection itself is still valid, it
   * simply belongs to a view you are not looking at, and switching back should bring it
   * straight back. Judged on the detail payload, because the list may still be loading
   * and "not in the list yet" is not "belongs elsewhere".
   */
  const onAnotherNumber = Boolean(
    numberId && selected?.whatsappIntegrationId && selected.whatsappIntegrationId !== numberId,
  );
  const openId = onAnotherNumber ? null : selectedId;
  const openConversation = onAnotherNumber ? null : selected;

  const messages = useMemo<InboxMessage[]>(() => {
    const detail = unwrap<InboxConversation>(detailData);
    return toArray<InboxMessage>(detail?.messages ?? unwrap<unknown>(detailData));
  }, [detailData]);

  /**
   * Who a chat can be handed to.
   *
   * The real team, from the server. This was built from whoever already appeared as an
   * assignee on a loaded row, so a teammate who had never been assigned anything could
   * never be assigned anything. Anyone still on a thread but no longer on the team is
   * merged in so their name renders instead of a bare id.
   */
  const { data: teamData } = useAssignableAgents();
  const agents = useMemo<InboxAgent[]>(() => {
    const byId = new Map<string, InboxAgent>();
    for (const a of teamData?.agents ?? []) byId.set(a.id, a);
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
  }, [all, teamData, userId, userName, userAvatar]);

  return (
    // The dashboard <main> adds p-4/lg:p-6 and the topbar is h-16 — cancel both so
    // the inbox owns the full viewport and each column scrolls independently. dvh, not
    // vh, so the composer stays above the on-screen keyboard and mobile browser chrome.
    // Phones show the list OR the open thread; md+ shows both side by side.
    <div className="-m-4 flex h-[calc(100dvh-4rem)] overflow-hidden bg-white lg:-m-6">
      <ConversationList
        conversations={conversations}
        selectedId={openId}
        onSelect={handleSelect}
        isLoading={listBusy}
        isError={listError && !listData}
        search={search}
        onSearchChange={setSearch}
        tab={tab}
        onTabChange={setTab}
        onStartChat={handleSelect}
        className={cn("w-full shrink-0 md:w-80", openId && "hidden md:flex")}
      />

      {/* Keyed so composer/tab state resets cleanly when a different thread opens. */}
      <ChatWindow
        key={openId ?? "empty"}
        conversation={openConversation}
        messages={messages}
        isLoading={detailBusy}
        isError={detailError && !detailData}
        onBack={() => {
          setSelectedId(null);
          setPanelOpen(false);
        }}
        onShowContact={() => setPanelOpen(true)}
        agents={agents}
        className={cn("min-w-0 flex-1", openId ? "flex" : "hidden md:flex")}
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
        key={`panel-${openId ?? "empty"}`}
        conversation={openConversation}
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
