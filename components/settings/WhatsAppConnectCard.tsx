"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  KeyRound,
  Link2Off,
  Loader2,
  Pencil,
  RefreshCw,
  Star,
  PlugZap,
  ShieldCheck,
} from "lucide-react";
import { Badge, Button, Card, Field, inputClass, Modal, Skeleton } from "@/components/ui";
import { useBusinesses, type BusinessDTO } from "@/hooks/useBusinesses";
import {
  useConnectWhatsApp,
  useDisconnectWhatsApp,
  useManualConnectWhatsApp,
  useTestWhatsAppConnection,
  useUpdateWhatsAppIntegration,
  useWhatsAppHealth,
  useWhatsAppIntegrations,
  useWhatsAppSignupConfig,
  type WhatsAppHealthDTO,
  type WhatsAppIntegrationDTO,
  type WhatsAppTestDTO,
} from "@/hooks/useWhatsAppConnection";
import { cn } from "@/lib/utils";
import { CallingToggle } from "@/components/calls/CallingToggle";

// ─── FB SDK type declarations ─────────────────────────────────────────────────
declare global {
  interface Window {
    FB: {
      init(opts: { appId: string; autoLogAppEvents: boolean; xfbml: boolean; version: string }): void;
      login(
        callback: (response: { authResponse?: { code?: string; accessToken?: string } | null }) => void,
        opts: { config_id: string; response_type: string; override_default_response_type: boolean; extras?: object }
      ): void;
    };
    fbAsyncInit?: () => void;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Meta's official WhatsApp Embedded Signup, as a card.
//
// The button below really does run Meta's flow: it loads Facebook's JavaScript
// SDK and calls FB.login with the deployment's Facebook Login for Business
// `config_id`. Everything the customer sees after that — the terms, the business
// portfolio picker, the WABA picker, phone verification — is Meta's own dialog,
// rendered by Meta, on Meta's domain.
//
// Two things come back on two different channels, which is the part worth
// knowing when reading this file:
//
//   · a `postMessage` of type WA_EMBEDDED_SIGNUP carrying waba_id / phone_number_id
//   · the FB.login callback carrying a single-use authorization code
//
// Neither is acted on here. Both are posted to our server, which exchanges the
// code for a token and then re-derives the ids from Meta rather than believing
// the ones this component forwarded. The code expires after thirty seconds, so
// the POST goes out immediately on the callback.
// ─────────────────────────────────────────────────────────────────────────────

/** Payload Meta posts to the page window during the Embedded Signup flow. */
interface EmbeddedSignupMessage {
  type?: string;
  event?: string;
  data?: {
    waba_id?: string;
    phone_number_id?: string;
    business_id?: string;
    current_step?: string;
    error_message?: string;
  };
}

/**
 * True only for facebook.com and its subdomains.
 *
 * Meta's own sample uses `origin.endsWith('facebook.com')`, which also accepts
 * `https://notfacebook.com` — a domain anyone can register. Since this listener is what
 * decides whether a message is treated as onboarding data, the host is parsed and matched
 * on a label boundary instead.
 */
function isFacebookOrigin(origin: string): boolean {
  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== "https:") return false;
    return hostname === "facebook.com" || hostname.endsWith(".facebook.com");
  } catch {
    return false;
  }
}

/**
 * Show an id without printing it in full.
 *
 * WABA and phone number ids are not secrets, but this panel is the kind of screen an agent
 * has open during a screen share, and four trailing digits identify the account to its owner
 * while being useless to anyone watching.
 */
function maskId(id: string | null | undefined): string {
  if (!id) return "—";
  const trimmed = id.trim();
  return trimmed.length <= 4 ? "••••" : `••••${trimmed.slice(-4)}`;
}

/** One label/value row in the connected-account summary. */
function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 truncate text-sm text-slate-900",
          mono && "font-mono text-xs text-slate-600",
        )}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}

/** WhatsApp's glyph, for the avatar on each connected number. */
function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("fill-current", className)}>
      <path d="M17.47 14.38c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.9-.92 1.08-.15.18-.3.2-.57.07-.27-.15-1.02-.38-1.95-1.2-.72-.64-1.2-1.43-1.35-1.7-.15-.3-.02-.45.12-.6.13-.14.3-.35.45-.52.14-.17.19-.3.29-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.03 1.01-1.03 2.46 0 1.45 1.05 2.85 1.2 3.05.15.2 2.07 3.16 5.01 4.32 2.45.96 2.95.77 3.48.72.53-.05 1.72-.7 1.96-1.38.24-.67.24-1.25.17-1.37-.07-.12-.27-.2-.57-.35ZM12.04 21.5h-.01a9.4 9.4 0 0 1-4.78-1.31l-.34-.2-3.55.93.95-3.47-.22-.36a9.38 9.38 0 0 1-1.44-5.01c0-5.18 4.22-9.4 9.4-9.4a9.34 9.34 0 0 1 6.64 2.76 9.33 9.33 0 0 1 2.75 6.65c0 5.18-4.22 9.4-9.4 9.4ZM20.5 3.49A11.78 11.78 0 0 0 12.04 0C5.46 0 .1 5.35.1 11.93c0 2.1.55 4.16 1.6 5.97L0 24l6.26-1.64a11.9 11.9 0 0 0 5.78 1.47h.01c6.57 0 11.93-5.35 11.93-11.93 0-3.19-1.24-6.19-3.49-8.44Z" />
    </svg>
  );
}

/** Meta's brand glyph for the official login button. */
function FacebookGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 shrink-0 fill-current">
      <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07Z" />
    </svg>
  );
}

/** Per-number outcome of the last Test press, shown on that number's card. */
type TestOutcome =
  | { ok: true; data: Extract<WhatsAppTestDTO, { ok: true }> }
  | { ok: false; error: string };

/** A copy of `record` without `key`. */
function withoutKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
}

/** Meta's quality rating as a coloured badge — GREEN/YELLOW/RED are Meta's own values. */
function qualityClass(rating: string | null): string {
  switch (rating?.toUpperCase()) {
    case "GREEN":
      return "text-emerald-700";
    case "YELLOW":
      return "text-amber-700";
    case "RED":
      return "text-rose-700";
    default:
      return "";
  }
}

/** The same rating as a dot, for the one-line summary where there is no room for a word. */
function qualityDot(rating: string | null): string {
  switch (rating?.toUpperCase()) {
    case "GREEN":
      return "bg-emerald-500";
    case "YELLOW":
      return "bg-amber-500";
    case "RED":
      return "bg-rose-500";
    default:
      return "bg-slate-300";
  }
}

/**
 * Meta's enum values are not sentences. `NOT_VERIFIED`, `CODE_VERIFICATION_PENDING` and the
 * rest were printed into the panel exactly as the Graph API spells them.
 */
function titleCase(value: string): string {
  const words = value.replace(/_/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Meta's `code_verification_status`, in words. */
function verificationLabel(status: string | null): string {
  if (!status) return "—";
  switch (status.toUpperCase()) {
    case "VERIFIED":
      return "Verified";
    case "NOT_VERIFIED":
      return "Not verified";
    case "EXPIRED":
      return "Expired — verify the number again in WhatsApp Manager";
    case "UNKNOWN":
      return "Not reported";
    default:
      return titleCase(status);
  }
}

/**
 * One connected number: a single summary line that opens to reveal its settings.
 *
 * Every number used to render all of its identifiers, its calling switch and four buttons
 * at once, so a business with three numbers was several screens of scrolling before the
 * form below it came into view. The identifiers are reference material — looked at once
 * during setup and never again — so they wait behind the chevron, and what stays on screen
 * is the line that answers "is this number working": name, number, quality and state.
 *
 * Closing the panel also unmounts `CallingToggle`, which is one request to Meta per number;
 * only the number being looked at asks.
 */
function IntegrationCard({
  integration,
  health,
  outcome,
  testing,
  promoting,
  expanded,
  onToggle,
  onTest,
  onRename,
  onMakeDefault,
  onDisconnect,
}: {
  integration: WhatsAppIntegrationDTO;
  health: WhatsAppHealthDTO | undefined;
  outcome: TestOutcome | undefined;
  testing: boolean;
  promoting: boolean;
  expanded: boolean;
  onToggle: () => void;
  onTest: () => void;
  onRename: () => void;
  onMakeDefault: () => void;
  onDisconnect: () => void;
}) {
  const label = integration.phoneNumber || integration.displayName || "this number";
  const panelId = `wa-number-${integration.id}`;
  // Meta's current answer wins over the copy stored when the number was connected.
  const quality = health?.qualityRating ?? integration.qualityRating;
  const verification = health?.status ?? integration.codeVerificationStatus;
  const healthError = health?.error ?? null;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-white transition",
        expanded ? "border-slate-300 shadow-sm" : "border-slate-200 hover:border-slate-300",
        !integration.isActive && "border-dashed",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="flex w-full items-center gap-3 px-3 py-3 text-left sm:px-4"
      >
        <span
          className={cn(
            "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            integration.isActive ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400",
          )}
        >
          <WhatsAppGlyph className="h-5 w-5" />
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white",
              integration.isActive ? "bg-emerald-500" : "bg-slate-300",
            )}
            aria-hidden
          />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-slate-900">
              {integration.displayName || "WhatsApp Business"}
            </span>
            {/* The star carries "default" where the badge below has no room: phone width. */}
            {integration.isDefault && (
              <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400 sm:hidden" aria-label="Default number" />
            )}
          </span>
          <span className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
            <span className="truncate font-mono tabular-nums">
              {integration.phoneNumber || "Number unavailable"}
            </span>
            {integration.isActive ? (
              <>
                <span aria-hidden>·</span>
                <span className={cn("flex min-w-0 items-center gap-1", healthError && "text-rose-600")}>
                  <span
                    className={cn("h-1.5 w-1.5 shrink-0 rounded-full", healthError ? "bg-rose-500" : qualityDot(quality))}
                    aria-hidden
                  />
                  <span className="truncate">
                    {healthError ?? (quality ? quality.toLowerCase() : "no rating yet")}
                  </span>
                </span>
              </>
            ) : (
              <>
                <span aria-hidden>·</span>
                <span className="shrink-0 text-slate-400">disconnected</span>
              </>
            )}
          </span>
        </span>

        {integration.isDefault && (
          <Badge className="hidden shrink-0 bg-emerald-50 text-emerald-700 ring-emerald-600/20 sm:inline-flex">
            Default
          </Badge>
        )}
        {outcome && !expanded && (
          outcome.ok ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-label="Last test passed" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" aria-label="Last test failed" />
          )
        )}
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform", expanded && "rotate-180")}
          aria-hidden
        />
      </button>

      {expanded && (
        <div id={panelId} className="border-t border-slate-200 bg-slate-50/60 px-3 pb-4 pt-3 sm:px-4">
          {integration.isActive && (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={onTest}
                disabled={testing}
                aria-label={`Test connection for ${label}`}
              >
                {testing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <PlugZap className="h-3.5 w-3.5" aria-hidden />
                )}
                {testing ? "Testing…" : "Test"}
              </Button>
              <Button size="sm" variant="secondary" onClick={onRename} aria-label={`Rename ${label}`}>
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                Rename
              </Button>
              {!integration.isDefault && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={onMakeDefault}
                  disabled={promoting}
                  aria-label={`Make ${label} the default number`}
                >
                  {promoting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Star className="h-3.5 w-3.5" aria-hidden />
                  )}
                  {promoting ? "Setting…" : "Make default"}
                </Button>
              )}
              <Button
                size="sm"
                variant="secondary"
                onClick={onDisconnect}
                aria-label={`Disconnect ${label}`}
                className="sm:ml-auto"
              >
                <Link2Off className="h-3.5 w-3.5" aria-hidden />
                Disconnect
              </Button>
            </div>
          )}

          {outcome && (
            <div
              role={outcome.ok ? "status" : "alert"}
              className={cn(
                "mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
                outcome.ok
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-rose-200 bg-rose-50 text-rose-800",
              )}
            >
              {outcome.ok ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
              ) : (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-hidden />
              )}
              <p className="min-w-0">
                {outcome.ok
                  ? `Connection successful — Meta answered for ${outcome.data.displayPhoneNumber ?? label}${
                      outcome.data.qualityRating ? ` (quality ${outcome.data.qualityRating})` : ""
                    }.`
                  : `Test failed: ${outcome.error}`}
              </p>
            </div>
          )}

          {/* The summary line truncates; the whole sentence belongs where there is room. */}
          {healthError && (
            <p className="mt-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-hidden />
              <span className="min-w-0">{healthError}</span>
            </p>
          )}

          {integration.isActive && <CallingToggle integrationId={integration.id} />}

          <dl className="mt-3 grid gap-x-4 gap-y-3 rounded-lg border border-slate-200 bg-white px-3 py-3 sm:grid-cols-2 lg:grid-cols-3">
            <DetailRow label="WABA ID" value={maskId(integration.whatsappBusinessId)} mono />
            <DetailRow label="Phone number ID" value={maskId(integration.phoneNumberId)} mono />
            <div className="min-w-0">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Quality rating</dt>
              <dd className={cn("mt-0.5 truncate text-sm text-slate-900", qualityClass(quality))}>
                {quality ? titleCase(quality) : "—"}
              </dd>
            </div>
            <DetailRow label="Verification" value={verificationLabel(verification)} />
            <DetailRow label="Connected" value={new Date(integration.createdAt).toLocaleDateString()} />
          </dl>

          {!integration.isActive && (
            <p className="mt-3 text-xs text-slate-500">
              Conversations on this number can&apos;t be answered until it is reconnected.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function WhatsAppConnectCard({ businessId }: { businessId?: string }) {
  const { data: businessesData, isLoading: businessesLoading } = useBusinesses();
  const { data: config, isLoading: configLoading, error: configError } = useWhatsAppSignupConfig();

  const target: BusinessDTO | undefined = (() => {
    const list = businessesData?.data ?? [];
    const wanted = businessId ?? businessesData?.currentBusinessId;
    return list.find((b) => b.id === wanted);
  })();

  const {
    data: integrationsData,
    isLoading: integrationsLoading,
    error: integrationsError,
  } = useWhatsAppIntegrations(target?.id);

  const connect = useConnectWhatsApp();
  const manualConnect = useManualConnectWhatsApp();
  const disconnect = useDisconnectWhatsApp();
  const test = useTestWhatsAppConnection();
  const updateIntegration = useUpdateWhatsAppIntegration();

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [testOutcomes, setTestOutcomes] = useState<Record<string, TestOutcome>>({});
  const [confirmDisconnect, setConfirmDisconnect] = useState<WhatsAppIntegrationDTO | null>(null);
  // Which number's panel is open. One at a time, so the page stays the length of the list.
  // `null` means "not chosen yet" and `""` means "chosen: none" — the difference matters
  // because a business with a single number should find it already open.
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Manual credential entry form
  const [manualOpen, setManualOpen] = useState(false);
  const [manualToken, setManualToken] = useState("");
  const [manualPhoneId, setManualPhoneId] = useState("");
  const [manualWabaId, setManualWabaId] = useState("");
  const [manualAppSecret, setManualAppSecret] = useState("");
  // The number being renamed, and the draft label. Only our own label is editable
  // here — Meta's identifiers and every credential are refused by the endpoint.
  const [renaming, setRenaming] = useState<WhatsAppIntegrationDTO | null>(null);
  const [draftName, setDraftName] = useState("");

  // waba_id / phone_number_id from Meta's postMessage events during the flow.
  const signupDataRef = useRef<EmbeddedSignupMessage["data"] | null>(null);
  const abortReasonRef = useRef<string | null>(null);
  const [fbReady, setFbReady] = useState(false);

  const integrations: WhatsAppIntegrationDTO[] = integrationsData?.integrations ?? [];
  const openId = expandedId === null && integrations.length === 1 ? integrations[0].id : expandedId;
  const activeCount = integrations.filter((i) => i.isActive).length;
  const health = useWhatsAppHealth(activeCount > 0);
  const healthById = new Map((health.data ?? []).map((h) => [h.integrationId, h]));
  const hasLegacyCredentials = integrationsData?.hasLegacyCredentials ?? false;
  const isConnected = activeCount > 0 || hasLegacyCredentials;

  // Load the Facebook JS SDK once when the app ID is available.
  useEffect(() => {
    if (!config?.appId || typeof window === "undefined") return;

    // Every path to "ready" goes through this callback rather than setting state
    // in the effect body: a synchronous setState here re-renders the card before
    // it has painted once, which is what react-hooks/set-state-in-effect reports.
    // The flag makes a late callback a no-op after unmount.
    let cancelled = false;
    const markReady = () => {
      if (!cancelled) setFbReady(true);
    };

    // Assigned on every mount, and before the script is appended. The SDK calls
    // fbAsyncInit the moment it finishes parsing, and a callback left behind by
    // an earlier mount closes over that mount's setState — after a remount it
    // would fire into nothing and leave the button stuck on "Loading Meta…".
    window.fbAsyncInit = () => {
      window.FB.init({
        appId: config.appId!,
        autoLogAppEvents: true,
        xfbml: true,
        version: "v21.0",
      });
      console.log("[WA Connect] Facebook SDK initialised, appId:", config.appId);
      markReady();
    };

    // Already initialised by an earlier mount. The SDK will not call fbAsyncInit
    // again, so readiness is scheduled instead — still a callback, not the body.
    if (window.FB) {
      const timer = setTimeout(markReady, 0);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }

    // A script tag already in the document is still loading; its own onload will
    // call the fbAsyncInit just assigned, so appending another would load the
    // SDK twice.
    if (!document.getElementById("facebook-jssdk")) {
      const script = document.createElement("script");
      script.id = "facebook-jssdk";
      script.src = "https://connect.facebook.net/en_US/sdk.js";
      script.async = true;
      script.defer = true;
      script.crossOrigin = "anonymous";
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
    };
  }, [config?.appId]);

  // Listen for Meta's WA_EMBEDDED_SIGNUP postMessage events.
  // These fire while the user moves through the flow and carry waba_id / phone_number_id.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!isFacebookOrigin(event.origin)) return;

      let payload: EmbeddedSignupMessage | null = null;
      try {
        payload =
          typeof event.data === "string"
            ? (JSON.parse(event.data) as EmbeddedSignupMessage)
            : (event.data as EmbeddedSignupMessage);
      } catch {
        return;
      }
      if (payload?.type !== "WA_EMBEDDED_SIGNUP") return;

      if (payload.event === "CANCEL") {
        const step = payload.data?.current_step;
        abortReasonRef.current = payload.data?.error_message
          ? `Meta reported a problem during onboarding: ${payload.data.error_message}`
          : step
            ? `You closed Meta's window before finishing (last step: ${step.replace(/_/g, " ").toLowerCase()}).`
            : "You closed Meta's window before finishing.";
        return;
      }
      if (payload.event === "ERROR") {
        abortReasonRef.current =
          payload.data?.error_message ?? "Meta could not complete the onboarding. Please try again.";
        return;
      }
      if (payload.data) {
        signupDataRef.current = payload.data;
        abortReasonRef.current = null;
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const launchSignup = () => {
    console.log("[WA Connect] launchSignup called", {
      configId: config?.configId ? "set" : "missing",
      appId: config?.appId ? "set" : "missing",
      fbReady,
      protocol: window.location.protocol,
      target: target?.id,
    });

    if (!config?.configId || !config?.appId) return;

    if (window.location.protocol !== "https:") {
      setError("WhatsApp Embedded Signup requires a secure (HTTPS) connection.");
      return;
    }

    if (!fbReady || !window.FB) {
      console.warn("[WA Connect] FB SDK not ready — fbReady:", fbReady, "window.FB:", !!window.FB);
      setError("Facebook SDK is still loading. Wait a moment and try again.");
      return;
    }

    setError(null);
    setNotice(null);
    setWarnings([]);
    signupDataRef.current = null;
    abortReasonRef.current = null;

    // Official Meta Embedded Signup: uses FB.login() from the JS SDK.
    // The code is delivered directly to the callback — no redirect_uri needed,
    // and no URL needs to be registered in Meta's Valid OAuth Redirect URIs.
    window.FB.login(
      (response) => {
        const code = response?.authResponse?.code;
        if (!code) {
          setError(
            abortReasonRef.current ??
              "Meta's window was closed before finishing. Nothing was changed — you can try again.",
          );
          return;
        }

        const data = signupDataRef.current;
        console.log("[WA Signup] code received:", code.slice(0, 8) + "...");
        console.log("[WA Signup] signup data:", JSON.stringify(data));

        connect.mutate(
          {
            token: code,
            wabaId: data?.waba_id,
            phoneNumberId: data?.phone_number_id,
            businessId: target?.id,
            // No redirectUri — FB.login() doesn't use a redirect, so the exchange omits it.
          },
          {
            onSuccess: (result) => {
              const number =
                result.data.integration.phoneNumber ?? result.data.integration.displayName ?? "WhatsApp";
              setWarnings(result.warnings ?? []);
              setNotice(
                result.data.created
                  ? `${number} is connected.`
                  : `${number} was already connected — its access and details were refreshed.`,
              );
            },
            onError: (err) => {
              setError(err instanceof Error ? err.message : "Could not complete the connection");
            },
          },
        );
      },
      {
        config_id: config.configId,
        response_type: "code",
        override_default_response_type: true,
        extras: { setup: {} },
      },
    );
  };

  const submitManual = () => {
    const token = manualToken.trim();
    const phoneId = manualPhoneId.trim();
    const wabaId = manualWabaId.trim();
    if (!token || !phoneId || !wabaId) return;
    setError(null);
    setNotice(null);
    setWarnings([]);
    manualConnect.mutate(
      { accessToken: token, phoneNumberId: phoneId, wabaId, businessId: target?.id, appSecret: manualAppSecret.trim() || undefined },
      {
        onSuccess: (result) => {
          const number =
            result.data.integration.phoneNumber ?? result.data.integration.displayName ?? "WhatsApp";
          setWarnings(result.warnings ?? []);
          setNotice(
            result.data.created
              ? `${number} is connected.`
              : `${number} was already connected — its credentials were updated.`,
          );
          setManualToken("");
          setManualPhoneId("");
          setManualWabaId("");
          setManualAppSecret("");
          setManualOpen(false);
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : "Could not complete the connection");
        },
      },
    );
  };

  const runTest = (integration: WhatsAppIntegrationDTO) => {
    setTestOutcomes((prev) => withoutKey(prev, integration.id));
    test.mutate(integration.id, {
      // The request succeeding only means Meta answered. Whether it accepted the
      // credentials is `data.ok`, and skipping that check is what showed a dead number
      // as "Connection successful".
      onSuccess: (result) =>
        setTestOutcomes((prev) => ({
          ...prev,
          [integration.id]: result.data.ok
            ? { ok: true, data: result.data }
            : { ok: false, error: result.data.error },
        })),
      onError: (err) =>
        setTestOutcomes((prev) => ({
          ...prev,
          [integration.id]: {
            ok: false,
            error: err instanceof Error ? err.message : "Connection test failed",
          },
        })),
    });
  };

  const openRename = (integration: WhatsAppIntegrationDTO) => {
    setError(null);
    setNotice(null);
    setDraftName(integration.displayName ?? "");
    setRenaming(integration);
  };

  const saveRename = () => {
    const integration = renaming;
    const name = draftName.trim();
    if (!integration || !name) return;
    updateIntegration.mutate(
      { integrationId: integration.id, displayName: name },
      {
        onSuccess: () => {
          setRenaming(null);
          setNotice(`Renamed to "${name}".`);
        },
        onError: (err) => {
          setRenaming(null);
          setError(err instanceof Error ? err.message : "Could not rename the number");
        },
      },
    );
  };

  const makeDefault = (integration: WhatsAppIntegrationDTO) => {
    setError(null);
    setNotice(null);
    updateIntegration.mutate(
      { integrationId: integration.id, isDefault: true },
      {
        onSuccess: () =>
          setNotice(
            `${integration.phoneNumber ?? integration.displayName ?? "That number"} is now the default. Campaigns and templates will use it.`,
          ),
        onError: (err) =>
          setError(err instanceof Error ? err.message : "Could not change the default number"),
      },
    );
  };

  const runDisconnect = () => {
    const integration = confirmDisconnect;
    if (!integration) return;
    setError(null);
    setNotice(null);
    disconnect.mutate(integration.id, {
      onSuccess: (result) => {
        setConfirmDisconnect(null);
        setTestOutcomes((prev) => withoutKey(prev, integration.id));
        setWarnings(result.warnings ?? []);
        setNotice(
          `${integration.phoneNumber ?? integration.displayName ?? "The number"} has been disconnected. Your other numbers, contacts and history are untouched.`,
        );
      },
      onError: (err) => {
        setConfirmDisconnect(null);
        setError(err instanceof Error ? err.message : "Could not disconnect");
      },
    });
  };

  if (configLoading || businessesLoading || integrationsLoading) {
    return (
      <Card className="p-5">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="mt-3 h-4 w-full max-w-72" />
        <Skeleton className="mt-5 h-10 w-full max-w-56" />
      </Card>
    );
  }

  const busy = connect.isPending || manualConnect.isPending;
  const sdkLoading = config?.enabled && !fbReady;

  return (
    <>
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 font-semibold text-slate-900">
              WhatsApp Business
              {isConnected && (
                <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-600/20">
                  Connected
                </Badge>
              )}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {isConnected
                ? "Manage the WhatsApp numbers connected to this business. Each conversation replies from the number the customer wrote to."
                : "Connect your WhatsApp Business account through Meta. No credentials to copy."}
            </p>
          </div>
          {target && (
            <Badge className="bg-slate-50 text-slate-600 ring-slate-500/15">{target.name}</Badge>
          )}
        </div>

        {integrationsError && (
          <p className="mt-4 text-sm text-rose-600">
            {integrationsError instanceof Error
              ? integrationsError.message
              : "Could not load the connected numbers."}
          </p>
        )}

        {/* The numbers come before the ways to add one: on a business that is already
            connected, this list is what the screen is for, and the setup form was pushing
            it below the fold. */}
        {target && integrations.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900">Connected numbers</h3>
              <div className="flex items-center gap-2">
                <p className="hidden text-xs text-slate-500 sm:block">
                  {activeCount} active · default number sends campaigns
                </p>
                {activeCount > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void health.refetch()}
                    disabled={health.isFetching}
                    className="h-7 px-2 text-xs"
                    aria-label="Refresh status from Meta"
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5", health.isFetching && "animate-spin")} aria-hidden />
                    Refresh
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-2.5 space-y-2">
              {integrations.map((integration) => (
                <IntegrationCard
                  key={integration.id}
                  integration={integration}
                  health={healthById.get(integration.id)}
                  outcome={testOutcomes[integration.id]}
                  testing={test.isPending && test.variables === integration.id}
                  promoting={
                    updateIntegration.isPending &&
                    updateIntegration.variables?.integrationId === integration.id &&
                    updateIntegration.variables?.isDefault === true
                  }
                  expanded={openId === integration.id}
                  onToggle={() => setExpandedId(openId === integration.id ? "" : integration.id)}
                  onTest={() => runTest(integration)}
                  onRename={() => openRename(integration)}
                  onMakeDefault={() => makeDefault(integration)}
                  onDisconnect={() => setConfirmDisconnect(integration)}
                />
              ))}
            </div>
          </div>
        )}

        {hasLegacyCredentials && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden />
            <p>
              This business still sends through credentials that were entered by hand before
              Meta onboarding existed. They keep working, but the number is not listed here
              with its own Test and Disconnect. Connect it through Meta below to move it
              across, or ask an administrator to run the WhatsApp backfill.
            </p>
          </div>
        )}

        {/* Deployment has not finished Meta app setup — say so plainly and leave the
            manual form below as the way through. */}
        {!config?.enabled && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="min-w-0">
              <p className="font-semibold">Meta onboarding isn&apos;t set up yet</p>
              <p className="mt-0.5 text-amber-800">
                {configError
                  ? "The connection settings could not be loaded."
                  : config?.missing?.length
                    ? `An administrator needs to set ${config.missing.join(", ")} on this deployment.`
                    : "An administrator needs to finish the Meta app configuration."}{" "}
                Until then, use manual setup below.
              </p>
            </div>
          </div>
        )}

        {isConnected && (
          <h3 className="mt-5 border-t border-slate-200 pt-4 text-sm font-semibold text-slate-900">
            Add another number
          </h3>
        )}

        {config?.enabled && (
          <div className={isConnected ? "mt-3" : "mt-5"}>
            {!target ? (
              <p className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                Create or select a business first, then connect your WhatsApp number here.
              </p>
            ) : (
              <>
                <button
                  type="button"
                  onClick={launchSignup}
                  disabled={busy || sdkLoading}
                  aria-busy={busy}
                  className={cn(
                    "inline-flex w-full items-center justify-center gap-2.5 rounded-lg px-4 py-2.5",
                    "text-sm font-semibold text-white shadow-sm transition sm:w-auto",
                    busy || sdkLoading ? "bg-slate-400 cursor-not-allowed" : "bg-[#1877F2] hover:bg-[#166FE5]",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1877F2] focus-visible:ring-offset-2",
                  )}
                >
                  {busy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      Finishing connection…
                    </>
                  ) : sdkLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      Loading Meta SDK…
                    </>
                  ) : (
                    <>
                      <FacebookGlyph />
                      {isConnected ? "Connect another number" : "Continue with Facebook"}
                    </>
                  )}
                </button>

                <p className="mt-3 flex items-start gap-1.5 text-xs text-slate-500">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                  You&apos;ll sign in with Meta and pick your WhatsApp Business account. We never see
                  your Meta password, and your access token is encrypted before it is stored.
                </p>
              </>
            )}
          </div>
        )}

        {/* ── Manual credential entry ───────────────────────────────────────
            Shown as an alternative when Embedded Signup is configured, or as the
            only option when it is not. Users who already have a permanent system
            user access token can use this instead of the Facebook flow.         */}
        <div className="mt-4">
          {/* A real option, not a footnote. This was grey text the width of a sentence,
              which read as small print next to the big blue Facebook button — so the
              path most people with an existing token should take looked like the one
              they were not meant to. */}
          <button
            type="button"
            onClick={() => setManualOpen((v) => !v)}
            aria-expanded={manualOpen}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition",
              manualOpen
                ? "border-slate-300 bg-slate-50"
                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
            )}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <KeyRound className="h-4 w-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-slate-800">
                {config?.enabled ? "Connect with your own token instead" : "Connect with your own token"}
              </span>
              <span className="block text-xs text-slate-500">
                For a number already set up in Meta Business Suite. Four values, two minutes.
              </span>
            </span>
            <ChevronDown
              className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform", manualOpen && "rotate-180")}
              aria-hidden
            />
          </button>

          {manualOpen && (
            <form
              onSubmit={(e) => { e.preventDefault(); submitManual(); }}
              className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4"
            >
              <p className="text-xs leading-relaxed text-slate-500">
                All four come from your Meta app. Open{" "}
                <a
                  href="https://business.facebook.com/wa/manage/phone-numbers/"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-emerald-700 underline underline-offset-2"
                >
                  WhatsApp Manager
                </a>{" "}
                in another tab and copy them across. The token is encrypted before it is stored.
              </p>

              <Field label="Access token — WhatsApp Manager → API Setup, or a permanent system-user token">
                <input
                  className={inputClass}
                  type="password"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  placeholder="EAAx…"
                  autoComplete="off"
                  required
                />
              </Field>

              <Field label="Phone number ID — under the number in API Setup (digits, not the phone number)">
                <input
                  className={inputClass}
                  value={manualPhoneId}
                  onChange={(e) => setManualPhoneId(e.target.value)}
                  placeholder="1234567890"
                  autoComplete="off"
                  required
                />
              </Field>

              <Field label="WhatsApp Business Account ID — same page, above the number">
                <input
                  className={inputClass}
                  value={manualWabaId}
                  onChange={(e) => setManualWabaId(e.target.value)}
                  placeholder="0987654321"
                  autoComplete="off"
                  required
                />
              </Field>

              <Field label="App secret — Meta app → Settings → Basic. Without it, messages cannot be received">
                <input
                  className={inputClass}
                  type="password"
                  value={manualAppSecret}
                  onChange={(e) => setManualAppSecret(e.target.value)}
                  placeholder="Meta app → Settings → Basic → App Secret"
                  autoComplete="off"
                />
              </Field>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end max-sm:[&>button]:h-10 max-sm:[&>button]:w-full">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setManualOpen(false);
                    setManualToken("");
                    setManualPhoneId("");
                    setManualWabaId("");
                  }}
                  disabled={manualConnect.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={
                    manualConnect.isPending ||
                    !manualToken.trim() ||
                    !manualPhoneId.trim() ||
                    !manualWabaId.trim() ||
                    !target
                  }
                >
                  {manualConnect.isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      Connecting…
                    </>
                  ) : (
                    "Connect"
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>

        {/* One live region for every non-error outcome, so a screen reader hears the
            result of a button press without the focus moving. */}
        <div role="status" aria-live="polite" className="empty:hidden">
          {notice && (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
              <p>{notice}</p>
            </div>
          )}

          {warnings.map((w) => (
            <div
              key={w}
              className="mt-3 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            >
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
              <p>{w}</p>
            </div>
          ))}
        </div>

        <div role="alert" className="empty:hidden">
          {error && (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" aria-hidden />
              <div className="min-w-0">
                <p className="font-semibold">Something went wrong</p>
                <p className="mt-0.5 text-rose-700">{error}</p>
              </div>
            </div>
          )}
        </div>
      </Card>

      <Modal
        open={!!renaming}
        onClose={() => {
          if (!updateIntegration.isPending) setRenaming(null);
        }}
        title="Rename this WhatsApp number"
        description="This is the label your team sees. It doesn't change anything at Meta — the number, its WABA and its verified name stay as they are."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveRename();
          }}
        >
          <Field label="Display name">
            <input
              className={inputClass}
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              maxLength={80}
              autoFocus
              placeholder="Support line"
            />
          </Field>
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end max-sm:[&>button]:h-10 max-sm:[&>button]:w-full">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setRenaming(null)}
              disabled={updateIntegration.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateIntegration.isPending || !draftName.trim()}>
              {updateIntegration.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!confirmDisconnect}
        onClose={() => {
          if (!disconnect.isPending) setConfirmDisconnect(null);
        }}
        title="Disconnect this WhatsApp number?"
        description={
          confirmDisconnect
            ? `${confirmDisconnect.phoneNumber ?? confirmDisconnect.displayName ?? "This number"} will stop sending and receiving WhatsApp messages. Conversations on it can't be answered until it is reconnected. Other numbers${
                confirmDisconnect.isDefault ? " keep working, and the next one becomes the default" : " keep working"
              }. Contacts, conversations, campaigns and templates are kept.`
            : ""
        }
      >
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end max-sm:[&>button]:h-10 max-sm:[&>button]:w-full">
          <Button
            variant="secondary"
            onClick={() => setConfirmDisconnect(null)}
            disabled={disconnect.isPending}
          >
            Cancel
          </Button>
          <Button variant="danger" onClick={runDisconnect} disabled={disconnect.isPending}>
            {disconnect.isPending ? "Disconnecting…" : "Disconnect"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
