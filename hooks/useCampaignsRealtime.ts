"use client";

import { useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRealtimeEvent, useRealtimeReconnect } from "@/hooks/useRealtime";
import { applyCampaignProgress } from "@/lib/realtime/campaignCache";

const RECIPIENTS_REFRESH_MS = 2_000;

/**
 * Live campaign counters. Aggregates are patched straight into every campaigns cache;
 * the open report's recipient table (not carried by the event) is refetched at most
 * every two seconds while that campaign is still moving.
 */
export function useCampaignsRealtime(openCampaignId?: string) {
  const queryClient = useQueryClient();
  const lastRecipientsRefresh = useRef(0);

  useRealtimeEvent("campaign:progress", (progress) => {
    queryClient.setQueriesData({ queryKey: ["campaigns"] }, (old: unknown) => applyCampaignProgress(old, progress));
    queryClient.setQueriesData({ queryKey: ["campaign"] }, (old: unknown) => applyCampaignProgress(old, progress));

    if (openCampaignId && progress.id === openCampaignId) {
      const now = Date.now();
      const terminal = progress.status === "COMPLETED" || progress.status === "CANCELLED" || progress.status === "FAILED";
      if (terminal || now - lastRecipientsRefresh.current > RECIPIENTS_REFRESH_MS) {
        lastRecipientsRefresh.current = now;
        void queryClient.invalidateQueries({ queryKey: ["campaign", openCampaignId] });
      }
    }
  });

  useRealtimeReconnect(() => {
    void queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    void queryClient.invalidateQueries({ queryKey: ["campaign"] });
  });
}
