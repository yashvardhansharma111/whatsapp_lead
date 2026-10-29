"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Bell, BellRing, ChevronDown, Megaphone, MessageSquare, PhoneMissed, Search,
  Sparkles, UserCheck, UserRound,
} from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";
import { Avatar } from "@/components/ui";
import { useMarkNotificationsRead, useNotificationList, useUnreadCount, type AppNotification } from "@/hooks/useNotifications";

type AgentStatus = "Online" | "Busy" | "Away";

const STATUS_DOT: Record<AgentStatus, string> = {
  Online: "bg-emerald-500",
  Busy: "bg-rose-500",
  Away: "bg-amber-500",
};

const TYPE_ICON: Record<string, typeof Bell> = {
  NEW_MESSAGE: MessageSquare,
  MISSED_CALL: PhoneMissed,
  CAMPAIGN_COMPLETED: Megaphone,
  CONVERSATION_ASSIGNED: UserRound,
  LEAD_ASSIGNED: UserRound,
  HANDOVER_REQUESTED: UserCheck,
  LEAD_QUALIFIED: Sparkles,
};

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: unread = 0 } = useUnreadCount();
  const list = useNotificationList(open);
  const markRead = useMarkNotificationsRead();

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const notifications: AppNotification[] = list.data?.pages.flatMap((p) => p.items) ?? [];

  function openOne(n: AppNotification) {
    setOpen(false);
    if (!n.readAt) markRead.mutate({ ids: [n.id] });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-haspopup="true"
        aria-expanded={open}
      >
        {unread > 0 ? <BellRing className="h-4.5 w-4.5" /> : <Bell className="h-4.5 w-4.5" />}
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white ring-2 ring-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-slate-900/5">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-sm font-semibold text-slate-900">Notifications</span>
            {unread > 0 && (
              <button
                onClick={() => markRead.mutate({ all: true })}
                className="text-xs font-medium text-emerald-700 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {list.isLoading ? (
              <p className="py-8 text-center text-sm text-slate-400">Loading…</p>
            ) : notifications.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">You&apos;re all caught up</p>
            ) : (
              notifications.map((n) => {
                const Icon = TYPE_ICON[n.type] ?? Bell;
                const inner = (
                  <>
                    {n.type === "NEW_MESSAGE" ? (
                      <Avatar name={n.title} size="sm" />
                    ) : (
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                        <Icon className="h-4 w-4" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate text-sm", n.readAt ? "text-slate-700" : "font-medium text-slate-900")}>{n.title}</p>
                      {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.body}</p>}
                      <p className="mt-1 text-[10px] text-slate-400">{timeAgo(new Date(n.createdAt))}</p>
                    </div>
                    {!n.readAt && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-label="Unread" />}
                  </>
                );
                const className = cn("flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50", !n.readAt && "bg-emerald-50/40");
                return n.href ? (
                  <Link key={n.id} href={n.href} onClick={() => openOne(n)} className={className}>{inner}</Link>
                ) : (
                  <button key={n.id} type="button" onClick={() => openOne(n)} className={className}>{inner}</button>
                );
              })
            )}
            {list.hasNextPage && (
              <button
                onClick={() => list.fetchNextPage()}
                disabled={list.isFetchingNextPage}
                className="block w-full border-t border-slate-100 py-2 text-center text-xs font-medium text-slate-500 hover:bg-slate-50"
              >
                {list.isFetchingNextPage ? "Loading…" : "Show older"}
              </button>
            )}
          </div>

          <div className="border-t border-slate-100 px-4 py-2.5">
            <Link
              href="/settings?tab=notifications"
              onClick={() => setOpen(false)}
              className="block text-center text-xs font-medium text-emerald-600 hover:underline"
            >
              Notification settings
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export function Topbar({ tenantName, reseller = false }: { tenantName?: string | null; reseller?: boolean }) {
  // Search and notifications read client data (contacts, leads, chats); a reseller
  // account has none and is refused by those APIs, so it gets a plain header.
  if (reseller) {
    return (
      <header className="flex h-16 shrink-0 items-center justify-end gap-3 border-b border-slate-200/70 bg-white/80 px-4 pl-16 backdrop-blur-sm lg:px-6 lg:pl-6">
        <span className="truncate text-sm font-medium text-slate-600">{tenantName}</span>
      </header>
    );
  }
  return <ClientTopbar tenantName={tenantName} />;
}

function ClientTopbar({ tenantName }: { tenantName?: string | null }) {
  const [status, setStatus] = useState<AgentStatus>("Online");
  const [statusOpen, setStatusOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<{ contacts: {id:string;name:string;phone:string}[]; leads: {id:string;title:string;stage:{name?:string|null}|null}[] } | null>(null);
  const [searching, setSearching] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close status dropdown on outside click
  useEffect(() => {
    if (!statusOpen) return;
    const handler = (e: MouseEvent) => {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) setStatusOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [statusOpen]);

  // Close search results on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchResults(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Debounced search
  useEffect(() => {
    if (search.trim().length < 2) return;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(search.trim())}`);
        const j = await r.json();
        setSearchResults(j.data ?? null);
      } catch {}
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200/70 bg-white/80 px-4 pl-16 backdrop-blur-sm lg:px-6 lg:pl-6">
      {/* Global search */}
      <div className="relative w-full max-w-sm" ref={searchRef}>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => {
            const value = e.target.value;
            setSearch(value);
            if (value.trim().length < 2) setSearchResults(null);
          }}
          placeholder="Search contacts, conversations, leads…"
          aria-label="Search"
          className="h-9 w-full rounded-lg bg-slate-50 pl-9 pr-3 text-sm text-slate-900 ring-1 ring-inset ring-transparent transition placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />

        {(searchResults || searching) && (
          <div className="absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-slate-900/5">
            {searching && <p className="px-4 py-3 text-sm text-slate-400">Searching…</p>}
            {searchResults && !searching && (
              <>
                {searchResults.contacts.length === 0 && searchResults.leads.length === 0 && (
                  <p className="px-4 py-3 text-sm text-slate-400">No results for &ldquo;{search}&rdquo;</p>
                )}
                {searchResults.contacts.length > 0 && (
                  <div>
                    <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Contacts</p>
                    {searchResults.contacts.map((c) => (
                      <Link key={c.id} href={`/contacts/${c.id}`} onClick={() => { setSearch(""); setSearchResults(null); }}
                        className="flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50">
                        <Avatar name={c.name} size="xs" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-slate-900">{c.name}</span>
                          <span className="block text-xs text-slate-500">{c.phone}</span>
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
                {searchResults.leads.length > 0 && (
                  <div>
                    <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Leads</p>
                    {searchResults.leads.map((l) => (
                      <Link key={l.id} href="/leads" onClick={() => { setSearch(""); setSearchResults(null); }}
                        className="flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50">
                        <span className="block truncate text-sm font-medium text-slate-900">{l.title}</span>
                        <span className="ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-600">{l.stage?.name ?? ""}</span>
                      </Link>
                    ))}
                  </div>
                )}
                <div className="h-2" />
              </>
            )}
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        {tenantName && (
          <span className="mr-1 hidden text-sm text-slate-500 md:inline">{tenantName}</span>
        )}

        <NotificationBell />

        <div className="relative" ref={statusRef}>
          <button
            onClick={() => setStatusOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={statusOpen}
            className="flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-200 transition hover:bg-slate-50"
          >
            <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[status])} />
            <span className="hidden sm:inline">{status}</span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>

          {statusOpen && (
            <div role="menu" className="absolute right-0 z-20 mt-1.5 w-36 overflow-hidden rounded-xl bg-white py-1 shadow-lg ring-1 ring-slate-900/5">
              {(Object.keys(STATUS_DOT) as AgentStatus[]).map((s) => (
                <button key={s} role="menuitem" onClick={() => { setStatus(s); setStatusOpen(false); }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50">
                  <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[s])} />
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
