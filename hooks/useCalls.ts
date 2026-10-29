"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { throwApiError } from "@/lib/billing/limits";
import type { IceServer } from "@/lib/calls/webrtc";

export interface CallRow {
  id: string;
  waCallId: string;
  direction: "INBOUND" | "OUTBOUND";
  status: "RINGING" | "CONNECTING" | "IN_PROGRESS" | "COMPLETED" | "MISSED" | "REJECTED" | "FAILED";
  fromPhone: string;
  toPhone: string;
  conversationId: string | null;
  ringingAt: string;
  answeredAt: string | null;
  endedAt: string | null;
  durationSec: number | null;
  errorTitle: string | null;
  contact: { id: string; name: string | null; phone: string; avatarUrl: string | null };
  answeredBy: { id: string; name: string | null } | null;
}

async function unwrap<T>(res: Response, fallback: string): Promise<T> {
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.success === false) throwApiError(json, fallback);
  return (json?.data ?? json) as T;
}

export const callApi = {
  iceServers: async (): Promise<IceServer[]> =>
    (await unwrap<{ iceServers: IceServer[] }>(await fetch("/api/calls/ice-servers"), "Couldn't load call settings")).iceServers,
  accept: (id: string, sdp: string) =>
    fetch(`/api/calls/${id}/accept`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sdp }) })
      .then((r) => unwrap<{ ok: boolean }>(r, "Couldn't answer the call")),
  reject: (id: string) => fetch(`/api/calls/${id}/reject`, { method: "POST" }).then((r) => unwrap<{ ok: boolean }>(r, "Couldn't decline the call")),
  hangup: (id: string) => fetch(`/api/calls/${id}/hangup`, { method: "POST" }).then((r) => unwrap<{ ok: boolean }>(r, "Couldn't end the call")),
};

export function useCallHistory(params: { page?: number; status?: string; contactId?: string; conversationId?: string } = {}) {
  return useQuery({
    queryKey: ["calls", params],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (params.page) qs.set("page", String(params.page));
      if (params.status) qs.set("status", params.status);
      if (params.contactId) qs.set("contactId", params.contactId);
      if (params.conversationId) qs.set("conversationId", params.conversationId);
      const res = await fetch(`/api/calls?${qs}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) throwApiError(json, "Couldn't load calls");
      return json as { data: CallRow[]; pagination: { page: number; limit: number; total: number; totalPages: number } };
    },
  });
}

export function useCallingSettings(integrationId: string | null) {
  return useQuery({
    queryKey: ["calls", "settings", integrationId],
    enabled: Boolean(integrationId),
    queryFn: async () =>
      unwrap<{ integrationId: string; enabled: boolean; error: string | null }>(
        await fetch(`/api/calls/settings/${integrationId}`),
        "Couldn't read calling settings",
      ),
    staleTime: 60_000,
  });
}

export function useSetCalling() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ integrationId, enabled }: { integrationId: string; enabled: boolean }) =>
      unwrap<{ integrationId: string; enabled: boolean }>(
        await fetch(`/api/calls/settings/${integrationId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled }),
        }),
        "Couldn't update calling",
      ),
    onSuccess: (data) => {
      queryClient.setQueryData(["calls", "settings", data.integrationId], (old: unknown) =>
        old && typeof old === "object" ? { ...old, enabled: data.enabled, error: null } : { ...data, error: null },
      );
      void queryClient.invalidateQueries({ queryKey: ["integrations"] });
    },
  });
}
