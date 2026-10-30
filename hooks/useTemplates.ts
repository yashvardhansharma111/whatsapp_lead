import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  ParameterFormat, TemplateButtonDraft, TemplateCardDraft, TemplateType,
} from "@/lib/templates/spec";

export type TemplateButton = TemplateButtonDraft;
export type TemplateCard = TemplateCardDraft;

export interface TemplateInput {
  name: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  language?: string;
  templateType?: TemplateType;
  parameterFormat?: ParameterFormat;
  body: string;
  headerType?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "LOCATION" | null;
  headerContent?: string | null;
  headerVariables?: string[];
  footer?: string | null;
  buttons?: TemplateButton[];
  variables?: string[];
  cards?: TemplateCard[] | null;
  /** The WhatsApp account this template lives in, when known. */
  wabaId?: string | null;
  ltoText?: string | null;
  ltoHasExpiration?: boolean;
  addSecurityRecommendation?: boolean;
  codeExpirationMinutes?: number | null;
  messageSendTtlSeconds?: number | null;
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

/** What a template media upload gives back: the approval handle, and a sendable URL. */
export interface UploadedMedia {
  handle: string;
  url: string | null;
}

const invalidate = (qc: ReturnType<typeof useQueryClient>) =>
  qc.invalidateQueries({ queryKey: ["templates"] });

async function unwrap<T>(res: Response, fallback: string): Promise<T> {
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? fallback);
  return (json.data ?? json) as T;
}

/**
 * @param whatsappIntegrationId narrows to templates the given number can actually send.
 *   A template belongs to a WhatsApp account, and Meta refuses one sent from a number
 *   outside its own, so offering all of them in a mixed workspace invites a rejection.
 */
export function useTemplates(whatsappIntegrationId?: string) {
  return useQuery({
    queryKey: ["templates", whatsappIntegrationId ?? "all"],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (whatsappIntegrationId) params.set("whatsappIntegrationId", whatsappIntegrationId);
      const res = await fetch(`/api/templates?${params}`);
      return unwrap<TemplateDTO[]>(res, "Couldn't load your templates");
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
      return unwrap<TemplateDTO>(res, "Couldn't create the template");
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
      return unwrap<TemplateDTO>(res, "Couldn't save the template");
    },
    onSuccess: () => invalidate(queryClient),
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
      await unwrap<unknown>(res, "Couldn't delete the template");
    },
    onSuccess: () => invalidate(queryClient),
  });
}

export function useDuplicateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/templates/${id}/duplicate`, { method: "POST" });
      return unwrap<TemplateDTO>(res, "Couldn't duplicate the template");
    },
    onSuccess: () => invalidate(queryClient),
  });
}

export function useSubmitTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/templates/${id}/submit`, { method: "POST" });
      return unwrap<TemplateDTO>(res, "Couldn't submit the template to Meta");
    },
    onSuccess: () => invalidate(queryClient),
  });
}

/** Meta's rules checked server-side, without spending a submission. */
export function useValidateTemplate() {
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/templates/${id}/validate`, { method: "POST" });
      return unwrap<{ valid: boolean; errors: string[] }>(res, "Couldn't check the template");
    },
  });
}

export function useRefreshTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/templates/${id}/refresh`, { method: "POST" });
      return unwrap<TemplateDTO>(res, "Couldn't refresh the status");
    },
    onSuccess: () => invalidate(queryClient),
  });
}

export function useSyncTemplates() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/templates/sync", { method: "POST" });
      return unwrap<{ enqueued: number }>(res, "Couldn't sync your templates");
    },
    onSuccess: () => invalidate(queryClient),
  });
}

/** Pull every template from the connected WhatsApp account into this workspace. */
export function useImportTemplates() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/templates/import", { method: "POST" });
      return unwrap<{ created: number; updated: number }>(res, "Couldn't import from Meta");
    },
    onSuccess: () => invalidate(queryClient),
  });
}

/**
 * Uploads a sample file. Meta approves a template against the resumable-upload handle,
 * while a sent message needs a URL, so both come back.
 */
export async function uploadTemplateMedia(file: File): Promise<UploadedMedia> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/templates/upload-media", { method: "POST", body: form });
  if (res.status === 413) throw new Error("That file is too large. The limit is 4 MB.");
  return unwrap<UploadedMedia>(res, "The upload failed. Try again.");
}
