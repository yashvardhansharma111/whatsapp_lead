"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// ─────────────────────────────────────────────────────────────────────────────
// React Query bindings for the WhatsApp Embedded Signup endpoints.
//
// Nothing secret passes through here in either direction: the config carries an
// app id and a Facebook Login configuration id (both public by construction, and
// both needed in the page for the SDK to work at all), and the connect response
// carries ids and display names only — never the access token.
// ─────────────────────────────────────────────────────────────────────────────

/** Non-secret Embedded Signup configuration, or the reason it is unavailable. */
export interface EmbeddedSignupConfigDTO {
  enabled: boolean;
  appId?: string;
  configId?: string;
  graphVersion?: string;

  /** Server-side variables an administrator still has to set. */
  missing?: string[];
}

/** What Meta told us about the account that was just connected. */
export interface WhatsAppConnectionDTO {
  wabaId: string;
  wabaName: string | null;
  phoneNumberId: string;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  qualityRating: string | null;
  codeVerificationStatus: string | null;
}

/** Result returned by the WhatsApp connection test. */
/**
 * The result of testing one number against Meta.
 *
 * A rejected credential is a valid answer to "is this connected?", not a failed request,
 * so the endpoint answers 200 in both cases and `ok` carries the verdict. Modelled as a
 * union rather than an interface with an `ok` field because the two shapes genuinely
 * differ — and because reading `displayPhoneNumber` off a failed test is exactly the
 * mistake that reported a dead number as "Connection successful".
 */
export type WhatsAppTestDTO =
  | {
      ok: true;
      integrationId: string | null;
      phoneNumberId: string;
      wabaId: string | null;
      displayPhoneNumber: string | null;
      verifiedName: string | null;
      qualityRating: string | null;
      codeVerificationStatus: string | null;
    }
  | { ok: false; error: string };

/**
 * A persisted WhatsApp number connected to a Business.
 *
 * Only non-secret fields: accessToken / verifyToken / appSecret are never returned.
 */
export interface WhatsAppIntegrationDTO {
  id: string;
  businessId: string;
  displayName: string | null;
  phoneNumber: string | null;
  phoneNumberId: string;
  whatsappBusinessId: string;
  qualityRating: string | null;
  codeVerificationStatus: string | null;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Response returned by GET /api/integrations/whatsapp. */
export interface WhatsAppIntegrationsDTO {
  business: { id: string; name: string };
  integrations: WhatsAppIntegrationDTO[];
  /** Hand-entered credentials exist that are not listed as a number yet. */
  hasLegacyCredentials: boolean;
}

/** The payload the browser collects from Meta and hands to our server to verify. */
export interface ConnectWhatsAppInput {
  token: string;
  wabaId?: string;
  phoneNumberId?: string;
  businessId?: string;
  redirectUri?: string;
}

/** Response of POST /api/integrations/whatsapp/connect. */
export interface ConnectWhatsAppResult {
  data: {
    integration: Omit<WhatsAppIntegrationDTO, "businessId" | "createdAt" | "updatedAt">;
    /** False when an already-connected number was reconnected (refreshed in place). */
    created: boolean;
  };
  connection: WhatsAppConnectionDTO;
  warnings: string[];
}

async function postJson<T>(url: string, body: unknown, fallbackError: string): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.success === false) {
    throw new Error(json?.error ?? fallbackError);
  }
  return json as T;
}

async function patchJson<T>(url: string, body: unknown, fallbackError: string): Promise<T> {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.success === false) {
    throw new Error(json?.error ?? fallbackError);
  }
  return json as T;
}

const INTEGRATIONS_KEY = ["whatsapp-integrations"] as const;

/** Loads the public Meta Embedded Signup configuration. */
export function useWhatsAppSignupConfig() {
  return useQuery<EmbeddedSignupConfigDTO>({
    queryKey: ["whatsapp-signup-config"],
    queryFn: async () => {
      const res = await fetch("/api/integrations/whatsapp/config");
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error ?? "Could not load the connection settings");
      }
      return json.data as EmbeddedSignupConfigDTO;
    },
    // The app id and config id change only when an administrator edits the
    // deployment's environment, so this is effectively static for a session.
    staleTime: 5 * 60_000,
    retry: false,
  });
}

/** Loads every WhatsApp number connected to a Business. */
export function useWhatsAppIntegrations(businessId?: string) {
  return useQuery<WhatsAppIntegrationsDTO>({
    queryKey: [...INTEGRATIONS_KEY, businessId],
    queryFn: async () => {
      const query = businessId ? `?businessId=${encodeURIComponent(businessId)}` : "";
      const res = await fetch(`/api/integrations/whatsapp${query}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) {
        throw new Error(json?.error ?? "Could not load WhatsApp integrations");
      }
      return json.data as WhatsAppIntegrationsDTO;
    },
    enabled: Boolean(businessId),
    staleTime: 30_000,
  });
}

/** One number's live state at Meta, as `GET /settings/whatsapp-health` returns it. */
export interface WhatsAppHealthDTO {
  integrationId: string;
  phoneNumber: string | null;
  qualityRating: string | null;
  /** Meta's `code_verification_status`. Null when Meta did not answer. */
  status: string | null;
  /** Why Meta did not answer, in a sentence. Null when it did. */
  error: string | null;
}

/**
 * Quality and verification as Meta reports them right now, per number.
 *
 * The integration row carries whatever Meta said when the number was connected, which can be
 * months old; this asks. It is one Graph call per active number server-side, so it is left to
 * go stale for a minute and refetched on demand rather than on every mount.
 */
export function useWhatsAppHealth(enabled: boolean) {
  return useQuery<WhatsAppHealthDTO[]>({
    queryKey: ["whatsapp-health"],
    queryFn: async () => {
      const res = await fetch("/api/settings/whatsapp-health");
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) {
        throw new Error(json?.error ?? "Could not read the numbers' status at Meta");
      }
      return (Array.isArray(json.data) ? json.data : []) as WhatsAppHealthDTO[];
    },
    enabled,
    staleTime: 60_000,
    retry: false,
  });
}

/** Everything that shows connection state: the number list, businesses, settings, onboarding. */
function invalidateConnectionState(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: INTEGRATIONS_KEY });
  queryClient.invalidateQueries({ queryKey: ["businesses"] });
  queryClient.invalidateQueries({ queryKey: ["settings"] });
  queryClient.invalidateQueries({ queryKey: ["onboarding"] });
}

/** Connect (or reconnect) a WhatsApp number through Meta Embedded Signup. */
export function useConnectWhatsApp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ConnectWhatsAppInput) =>
      postJson<ConnectWhatsAppResult>(
        "/api/integrations/whatsapp/connect",
        input,
        "Could not complete the WhatsApp connection",
      ),
    onSuccess: () => invalidateConnectionState(queryClient),
  });
}

/**
 * Disconnect ONE WhatsApp number. The business's other numbers are untouched.
 *
 * The id goes in the path. This sent it in the body to `/whatsapp/disconnect`, which is
 * not a route — the gateway has `POST /whatsapp/:id/disconnect` — so Disconnect answered
 * "Cannot POST /integrations/whatsapp/disconnect" and there was no way to remove a
 * number from the screen that offers it.
 */
export function useDisconnectWhatsApp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (integrationId: string) =>
      postJson<{ warnings: string[] }>(
        `/api/integrations/whatsapp/${encodeURIComponent(integrationId)}/disconnect`,
        {},
        "Could not disconnect WhatsApp",
      ),
    onSuccess: () => invalidateConnectionState(queryClient),
  });
}

/**
 * Remove a disconnected number from the list for good.
 *
 * Disconnecting only clears the token and marks the row inactive, which is right — the
 * conversations on that number still have to be readable. But nothing then took the row
 * away, so a number tried once and abandoned sat in Settings forever with no way to be
 * rid of it. The endpoint existed; only this call was missing.
 */
export function useDeleteWhatsAppIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (integrationId: string) => {
      const res = await fetch(`/api/integrations/whatsapp/${encodeURIComponent(integrationId)}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) {
        throw new Error(json?.error ?? "Could not remove this number");
      }
      return json as { deleted: boolean };
    },
    onSuccess: () => invalidateConnectionState(queryClient),
  });
}

/**
 * Edit what belongs to us on a connected number: its label, and whether it is the
 * business's default sender.
 *
 * Meta's own identifiers and every credential are rejected by the endpoint — those
 * change only by reconnecting through Embedded Signup.
 */
export function useUpdateWhatsAppIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      integrationId,
      ...body
    }: { integrationId: string; displayName?: string; isDefault?: true }) =>
      patchJson<{ data: WhatsAppIntegrationDTO }>(
        `/api/integrations/whatsapp/${encodeURIComponent(integrationId)}`,
        body,
        "Could not update the WhatsApp number",
      ),
    onSuccess: () => invalidateConnectionState(queryClient),
  });
}

export interface ManualConnectInput {
  accessToken: string;
  phoneNumberId: string;
  wabaId: string;
  businessId?: string;
  appSecret?: string;
}

export interface ManualConnectResult {
  data: {
    integration: Omit<WhatsAppIntegrationDTO, "businessId" | "createdAt" | "updatedAt">;
    created: boolean;
  };
  warnings: string[];
}

/** Connect a WhatsApp number by entering credentials (access token, phone number ID, WABA ID) directly. */
export function useManualConnectWhatsApp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ManualConnectInput) =>
      postJson<ManualConnectResult>(
        "/api/integrations/whatsapp/manual",
        input,
        "Could not complete the WhatsApp connection",
      ),
    onSuccess: () => invalidateConnectionState(queryClient),
  });
}

/** Test ONE WhatsApp number against Meta. Refreshes that number's stored details. */
export function useTestWhatsAppConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (integrationId: string) =>
      postJson<{ data: WhatsAppTestDTO }>(
        "/api/integrations/whatsapp/test",
        { integrationId },
        "Connection test failed",
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: INTEGRATIONS_KEY }),
  });
}
