import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface TemplateButton {
  type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER" | "OTP" | "COPY_CODE" | "VOICE_CALL";
  text: string;
  url?: string;
  phone?: string;
  urlType?: "STATIC" | "DYNAMIC";
  urlExample?: string;
  otpType?: "COPY_CODE";
  offerCode?: string;
}

export interface TemplateInput {
  name: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  language?: string;
  body: string;
  headerType?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | null;
  headerContent?: string | null;
  headerVariables?: string[];
  footer?: string;
  buttons?: TemplateButton[];
  variables?: string[];
}

export interface TemplateDTO extends TemplateInput {
  id: string;
  waTemplateId?: string | null;
  status: string;
  rejectionReason?: string | null;
  lastSyncedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

const invalidate = (qc: ReturnType<typeof useQueryClient>) =>
  qc.invalidateQueries({ queryKey: ["templates"] });

export function useTemplates() {
  return useQuery({
    queryKey: ["templates"],
    queryFn: async () => {
      const res = await fetch("/api/templates");
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error ?? "Failed to fetch templates");
      // API returns { success, data: TemplateDTO[] }
      return (json.data ?? json) as TemplateDTO[];
    },
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: TemplateInput) => {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to create template");
      }
      return res.json() as Promise<TemplateDTO>;
    },
    onSuccess: () => invalidate(queryClient),
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<TemplateInput> & { id: string }) => {
      const res = await fetch(`/api/templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to update template");
      }
      return res.json() as Promise<TemplateDTO>;
    },
    onSuccess: () => invalidate(queryClient),
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to delete template");
      }
    },
    onSuccess: () => invalidate(queryClient),
  });
}

export function useDuplicateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/templates/${id}/duplicate`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to duplicate template");
      }
      return res.json() as Promise<TemplateDTO>;
    },
    onSuccess: () => invalidate(queryClient),
  });
}

export function useSubmitTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/templates/${id}/submit`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as {
          error?: string;
          debug?: { metaPayload?: unknown; templateId?: string; metaError?: unknown } | null;
        };

        // ── Client-side debug logs ───────────────────────────────────────
        console.group("%c🔴 Template submit failed", "color:#dc2626;font-weight:bold");
        console.log("Template ID  :", id);
        console.log("Error message:", body.error ?? "(no message)");
        if (body.debug?.metaError) {
          console.group("%c↳ Meta API error", "color:#b91c1c");
          console.table(body.debug.metaError);
          console.groupEnd();
        }
        if (body.debug?.metaPayload) {
          console.group("%c↳ Payload sent to Meta", "color:#6b7280");
          console.log(JSON.stringify(body.debug.metaPayload, null, 2));
          console.groupEnd();
        } else {
          console.log("No payload debug available (error occurred before Meta call)");
        }
        console.groupEnd();
        // ────────────────────────────────────────────────────────────────

        const err = new Error(body.error ?? "Failed to submit template") as Error & { debug?: typeof body.debug };
        err.debug = body.debug;
        throw err;
      }
      return res.json() as Promise<TemplateDTO>;
    },
    onSuccess: () => invalidate(queryClient),
  });
}

export function useRefreshTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      console.group(`%c[TemplateSync] Refresh status templateId=${id}`, "color:#6366f1;font-weight:bold");
      console.time("[TemplateSync] refresh duration");
      console.log(`→ POST /api/templates/${id}/refresh`);
      const res = await fetch(`/api/templates/${id}/refresh`, { method: "POST" });
      console.log(`← HTTP ${res.status} ${res.statusText}`);
      if (!res.ok) {
        const raw = await res.text();
        let err: { error?: string; message?: string } = {};
        try { err = JSON.parse(raw); } catch { console.error("Non-JSON error body:", raw); }
        console.error("Refresh failed:", err);
        console.timeEnd("[TemplateSync] refresh duration");
        console.groupEnd();
        throw new Error(err.error ?? err.message ?? "Failed to refresh template");
      }
      const data = await res.json() as TemplateDTO;
      console.log(`Refresh result: status=${data.status} lastSyncedAt=${data.lastSyncedAt}`, data);
      console.timeEnd("[TemplateSync] refresh duration");
      console.groupEnd();
      return data;
    },
    onSuccess: () => invalidate(queryClient),
  });
}

export function useSyncTemplates() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      console.group("%c[TemplateSync] Sync pending → Meta", "color:#f59e0b;font-weight:bold");
      console.time("[TemplateSync] sync duration");
      console.log("→ POST /api/templates/sync");
      const res = await fetch("/api/templates/sync", { method: "POST" });
      console.log(`← HTTP ${res.status} ${res.statusText}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string; message?: string };
        console.error("Sync failed:", err);
        console.timeEnd("[TemplateSync] sync duration");
        console.groupEnd();
        throw new Error(err.error ?? err.message ?? "Failed to sync templates");
      }
      const data = await res.json();
      console.log("Sync result:", data);
      console.timeEnd("[TemplateSync] sync duration");
      console.groupEnd();
      return data;
    },
    onSuccess: () => invalidate(queryClient),
  });
}

/** Pull all templates from the connected Meta WABA and upsert into the local DB. */
export function useImportTemplates() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      console.group("%c[TemplateSync] Import from Meta", "color:#10b981;font-weight:bold");
      console.time("[TemplateSync] import duration");
      console.log("→ POST /api/templates/import");
      const res = await fetch("/api/templates/import", { method: "POST" });
      console.log(`← HTTP ${res.status} ${res.statusText}`);
      if (!res.ok) {
        const raw = await res.text();
        let err: { error?: string; message?: string } = {};
        try { err = JSON.parse(raw); } catch { console.error("Non-JSON error body:", raw); }
        console.error("Import failed:", err);
        console.timeEnd("[TemplateSync] import duration");
        console.groupEnd();
        throw new Error(err.error ?? err.message ?? "Failed to import templates from Meta");
      }
      const data = await res.json() as { success: boolean; created: number; updated: number };
      console.log(`Import result: created=${data.created} updated=${data.updated}`, data);
      console.timeEnd("[TemplateSync] import duration");
      console.groupEnd();
      return data;
    },
    onSuccess: () => invalidate(queryClient),
  });
}
