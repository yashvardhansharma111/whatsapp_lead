"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRealtimeEvent, useRealtimeReconnect } from "@/hooks/useRealtime";
import {
  applyConversationPatch, applyMessageNew, applyMessageUpdated, applyStatusUpdates,
} from "@/lib/realtime/inboxCache";

const PREFIX = { queryKey: ["conversations"] as const };

/**
 * Keeps every ["conversations", …] cache entry current from the socket — no
 * refetch for ordinary traffic. A reconnect refetches once to close any gap.
 */
export function useInboxRealtime() {
  const queryClient = useQueryClient();

  useRealtimeEvent("message:new", ({ message, conversation }) => {
    queryClient.setQueriesData(PREFIX, (old: unknown) => applyMessageNew(old, message, conversation));
  });

  useRealtimeEvent("message:updated", ({ messageId, conversationId, patch }) => {
    queryClient.setQueriesData(PREFIX, (old: unknown) => applyMessageUpdated(old, messageId, conversationId, patch));
  });

  useRealtimeEvent("message:status", ({ updates }) => {
    queryClient.setQueriesData(PREFIX, (old: unknown) => applyStatusUpdates(old, updates));
  });

  useRealtimeEvent("conversation:updated", ({ id, patch }) => {
    queryClient.setQueriesData(PREFIX, (old: unknown) => applyConversationPatch(old, id, patch));
  });

  useRealtimeReconnect(() => {
    void queryClient.invalidateQueries(PREFIX);
  });
}
