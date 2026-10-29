"use client";

import { useCallback } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRealtimeEvent, useRealtimeReconnect } from "@/hooks/useRealtime";
import type { RtNotification } from "@/lib/realtime/events";
import { DEFAULT_NOTIFICATION_PREFS, type NotificationPrefs } from "@/lib/notifications/prefs";

export type AppNotification = RtNotification;

interface Page {
  items: AppNotification[];
  nextCursor: string | null;
  unread: number;
}

const LIST_KEY = ["notifications", "list"] as const;
const COUNT_KEY = ["notifications", "unread"] as const;
const PREFS_KEY = ["notifications", "prefs"] as const;

async function unwrap<T>(res: Response): Promise<T> {
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.success === false) throw new Error(json?.error ?? `Request failed (${res.status})`);
  return (json?.data ?? json) as T;
}

/** The bell's list: cursor-paginated, kept current by the socket. */
export function useNotificationList(enabled: boolean) {
  return useInfiniteQuery({
    queryKey: LIST_KEY,
    enabled,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const qs = new URLSearchParams({ limit: "20" });
      if (pageParam) qs.set("cursor", pageParam);
      return unwrap<Page>(await fetch(`/api/notifications?${qs}`));
    },
    getNextPageParam: (last) => last.nextCursor,
    staleTime: 60_000,
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: COUNT_KEY,
    queryFn: async () => (await unwrap<Page>(await fetch("/api/notifications?limit=1"))).unread,
    staleTime: 60_000,
  });
}

/** Keeps the bell count and list in sync with the socket; mount once (NotificationProvider). */
export function useNotificationsRealtime() {
  const queryClient = useQueryClient();

  const upsert = useCallback(
    (n: AppNotification) => {
      queryClient.setQueryData(LIST_KEY, (old: { pages: Page[]; pageParams: unknown[] } | undefined) => {
        if (!old) return old;
        const pages = old.pages.map((p) => ({ ...p, items: p.items.filter((x) => x.id !== n.id) }));
        pages[0] = { ...pages[0], items: [n, ...pages[0].items] };
        return { ...old, pages };
      });
    },
    [queryClient],
  );

  useRealtimeEvent("notification:new", upsert);
  useRealtimeEvent("notification:updated", upsert);
  useRealtimeEvent("notification:count", ({ unread }) => queryClient.setQueryData(COUNT_KEY, unread));
  useRealtimeReconnect(() => {
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  });
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { ids: string[] } | { all: true }) =>
      unwrap<{ updated: number; unread: number }>(
        await fetch("/api/notifications/read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }),
      ),
    onMutate: (input) => {
      const now = new Date().toISOString();
      queryClient.setQueryData(LIST_KEY, (old: { pages: Page[]; pageParams: unknown[] } | undefined) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((p) => ({
            ...p,
            items: p.items.map((n) =>
              !n.readAt && ("all" in input || input.ids.includes(n.id)) ? { ...n, readAt: now } : n,
            ),
          })),
        };
      });
      if ("all" in input) queryClient.setQueryData(COUNT_KEY, 0);
    },
    onSuccess: (data) => queryClient.setQueryData(COUNT_KEY, data.unread),
  });
}

export function useNotificationPrefs() {
  return useQuery({
    queryKey: PREFS_KEY,
    queryFn: async () => unwrap<NotificationPrefs>(await fetch("/api/notifications/prefs")),
    staleTime: 5 * 60_000,
    placeholderData: DEFAULT_NOTIFICATION_PREFS,
  });
}

export function useSaveNotificationPrefs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (prefs: NotificationPrefs) =>
      unwrap<NotificationPrefs>(
        await fetch("/api/notifications/prefs", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(prefs),
        }),
      ),
    onSuccess: (prefs) => queryClient.setQueryData(PREFS_KEY, prefs),
  });
}
