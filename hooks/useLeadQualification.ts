"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type QualificationCriterion = "budget" | "authority" | "need" | "timeline" | "engagement";

export interface LeadQualificationConfig {
  enabled: boolean;
  trigger: string;
  afterMessages: number;
  requalify: boolean;
  requalifyAfterHours: number;
  keywords: string[];
  minScore: number;
  autoCreate: boolean;
  autoAssign: boolean;
  instructions: string | null;
  productContext: string | null;
  weights: Record<QualificationCriterion, number> | null;
  stageMap: Record<string, string> | null;
  model: string | null;
  notifyAboveScore: number;
}

export interface QualificationOptions {
  config: LeadQualificationConfig;
  stages: { id: string; name: string; color: string }[];
  defaultWeights: Record<QualificationCriterion, number>;
  criteria: QualificationCriterion[];
  triggers: string[];
  bands: { label: string; from: number }[];
}

/** What a scoring run concluded, as the server reports it. */
export interface QualifyResult {
  status: "created" | "updated" | "below_threshold" | "not_a_lead" | "skipped" | "no_model" | "no_config";
  leadId?: string;
  score?: number;
  label?: string;
  reason?: string;
}

async function unwrap<T>(res: Response, fallback: string): Promise<T> {
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? fallback);
  return (json.data ?? json) as T;
}

export function useLeadQualification() {
  return useQuery({
    queryKey: ["lead-qualification"],
    queryFn: async () =>
      unwrap<QualificationOptions>(await fetch("/api/leads/qualification"), "Couldn't load the scoring settings"),
  });
}

export function useSaveLeadQualification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<LeadQualificationConfig>) => {
      const res = await fetch("/api/leads/qualification", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return unwrap<LeadQualificationConfig>(res, "Couldn't save the scoring settings");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lead-qualification"] }),
  });
}

/** Score one conversation now, whatever the configured trigger says. */
export function useQualifyConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const res = await fetch("/api/leads/qualify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });
      return unwrap<QualifyResult>(res, "Couldn't score this conversation");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

// ─── Filters and export ───────────────────────────────────────────────────────

export interface LeadFilterOptions {
  stages: { id: string; name: string; color: string; outcome: string }[];
  agents: { id: string; name: string; role: string }[];
  tags: { name: string; color: string | null }[];
  scoreLabels: string[];
  qualifiedBy: string[];
  outcomes: string[];
  sorts: string[];
  columns: { key: string; label: string }[];
  defaultColumns: string[];
}

export function useLeadFilterOptions() {
  return useQuery({
    queryKey: ["lead-filter-options"],
    queryFn: async () =>
      unwrap<LeadFilterOptions>(await fetch("/api/leads/filters"), "Couldn't load the filter options"),
    staleTime: 5 * 60_000,
  });
}

/**
 * Downloads the filtered leads.
 *
 * The browser cannot be sent to the export URL directly: the proxy needs the session
 * cookie and the response is a file, so it is fetched as a blob and handed to a link
 * built for the purpose.
 */
export async function downloadLeadsCsv(params: URLSearchParams): Promise<number> {
  const res = await fetch(`/api/leads/export?${params}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `The export failed (${res.status})`);
  }
  const rows = Number(res.headers.get("x-row-count") ?? 0);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  return rows;
}
