"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type HandoverStatus = "PENDING" | "ASSIGNED" | "ACCEPTED" | "RESOLVED" | "CANCELLED";

export type HandoverReason =
  | "CUSTOMER_REQUEST" | "FLOW_NODE" | "AI_UNSURE" | "AFTER_REPLIES"
  | "NEGATIVE_SENTIMENT" | "OFF_HOURS" | "MANUAL";

/** Why each handover happened, worded for the queue. */
export const REASON_LABELS: Record<HandoverReason, string> = {
  CUSTOMER_REQUEST:   "They asked for a person",
  FLOW_NODE:          "The flow handed it over",
  AI_UNSURE:          "The AI was unsure",
  AFTER_REPLIES:      "Too many AI replies",
  NEGATIVE_SENTIMENT: "They sounded unhappy",
  OFF_HOURS:          "Outside business hours",
  MANUAL:             "Handed over by a colleague",
};

export interface Handover {
  id: string;
  conversationId: string;
  reason: HandoverReason;
  note: string | null;
  trigger: string | null;
  status: HandoverStatus;
  requestedAt: string;
  assignedAt: string | null;
  acceptedAt: string | null;
  resolvedAt: string | null;
  escalatedAt: string | null;
  department: { id: string; name: string; color: string } | null;
  assignedTo: { id: string; name: string } | null;
  conversation: {
    id: string;
    status: string;
    lastMessageAt: string | null;
    contact: { name: string; phone: string };
  } | null;
}

export interface Department {
  id: string;
  name: string;
  description: string | null;
  color: string;
  order: number;
  enabled: boolean;
  isDefault: boolean;
  members: { id: string; name: string; email: string; role: string; avatar: string | null }[];
  waitingCount: number;
}

export interface HandoverConfig {
  enabled: boolean;
  onCustomerRequest: boolean;
  requestKeywords: string[];
  onAiUnsure: boolean;
  aiUnsureThreshold: number;
  afterAiReplies: number;
  onNegativeSentiment: boolean;
  offHours: boolean;
  strategy: "LEAST_BUSY" | "ROUND_ROBIN" | "DEPARTMENT" | "SPECIFIC_USER";
  departmentId: string | null;
  assignToId: string | null;
  onlineOnly: boolean;
  pauseAi: boolean;
  notifyAgent: boolean;
  notifyManagers: boolean;
  customerMessage: string | null;
  escalateAfterMinutes: number;
}

async function unwrap<T>(res: Response, fallback: string): Promise<T> {
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? fallback);
  return (json.data ?? json) as T;
}

export interface HandoverFilters {
  status?: string;
  reason?: string;
  departmentId?: string;
  assignedToId?: string;
}

export function useHandovers(filters: HandoverFilters = {}) {
  return useQuery({
    queryKey: ["handovers", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(filters)) {
        if (value && value !== "ALL") params.set(key, value);
      }
      const res = await fetch(`/api/handovers?${params}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error ?? "Couldn't load the queue");
      // The gateway puts a paginated list in `data` with `pagination` beside it.
      return {
        handovers: (json.data ?? []) as Handover[],
        total: json.pagination?.total ?? 0,
        waiting: (json.waiting ?? 0) as number,
      };
    },
    refetchOnWindowFocus: true,
  });
}

/** Just the count, for the badge in the sidebar. */
export function useHandoverWaiting() {
  return useQuery({
    queryKey: ["handovers", "waiting"],
    queryFn: async () => {
      const res = await fetch("/api/handovers/waiting");
      const data = await unwrap<{ waiting: number }>(res, "Couldn't load the count");
      return data.waiting;
    },
    staleTime: 30_000,
  });
}

function useHandoverAction(action: "accept" | "resolve" | "cancel") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/handovers/${id}/${action}`, { method: "POST" });
      return unwrap<unknown>(res, `Couldn't ${action} this handover`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["handovers"] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

export const useAcceptHandover  = () => useHandoverAction("accept");
export const useResolveHandover = () => useHandoverAction("resolve");
export const useCancelHandover  = () => useHandoverAction("cancel");

/** Hand a conversation over by hand, from the inbox. */
export function useRequestHandover() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { conversationId: string; note?: string; departmentId?: string; assignToId?: string }) => {
      const res = await fetch("/api/handovers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return unwrap<{ handoverId: string; assignedToId: string | null }>(res, "Couldn't hand this over");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["handovers"] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

// ─── Departments ──────────────────────────────────────────────────────────────

export function useDepartments() {
  return useQuery({
    queryKey: ["departments"],
    queryFn: async () => unwrap<Department[]>(await fetch("/api/departments"), "Couldn't load departments"),
  });
}

export function useSaveDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Partial<Department> & { id?: string; memberIds?: string[] }) => {
      const res = await fetch(id ? `/api/departments/${id}` : "/api/departments", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return unwrap<Department>(res, "Couldn't save the department");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["departments"] }),
  });
}

export function useDeleteDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap<unknown>(await fetch(`/api/departments/${id}`, { method: "DELETE" }), "Couldn't delete the department"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["departments"] }),
  });
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export function useHandoverSettings() {
  return useQuery({
    queryKey: ["handover-settings"],
    queryFn: async () => unwrap<{
      config: HandoverConfig;
      defaultKeywords: string[];
      strategies: string[];
    }>(await fetch("/api/handovers/settings"), "Couldn't load the handover settings"),
  });
}

export function useSaveHandoverSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<HandoverConfig>) => {
      const res = await fetch("/api/handovers/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return unwrap<HandoverConfig>(res, "Couldn't save the handover settings");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["handover-settings"] }),
  });
}
