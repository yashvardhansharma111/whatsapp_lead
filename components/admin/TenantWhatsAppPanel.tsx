"use client";

// Super admin → one account's WhatsApp: each business's connected numbers (with
// quality, verification, last message), template counts, and the actions an
// operator needs — check the connection live, re-sync templates, disconnect.
// Backed by /api/admin/tenants/[id]/whatsapp.

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, KeyRound, Loader2, PlugZap, RefreshCw, Unplug } from "lucide-react";
import { AdminBadge, AdminButton, AdminPanel, AdminSkeletonRows, type AdminTone } from "@/components/admin/ui";
import { formatDate, timeAgo } from "@/lib/utils";

interface WaNumber {
  id: string;
  displayName: string | null;
  phoneNumber: string | null;
  phoneNumberId: string;
  whatsappBusinessId: string | null;
  qualityRating: string | null;
  codeVerificationStatus: string | null;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  conversations: number;
  lastMessageAt: string | null;
  hasToken: boolean;
  tokenReadable: boolean;
  tokenHint: string | null;
  hasAppSecret: boolean;
}

interface WaBusiness {
  id: string;
  name: string;
  numbers: WaNumber[];
  legacy: { phoneNumber: string | null; phoneNumberId: string; whatsappBusinessId: string | null; hasToken: boolean } | null;
  templates: { approved: number; inReview: number; other: number };
}

interface WaData {
  businesses: WaBusiness[];
  accountSettings: { phoneNumberId: string; whatsappBusinessId: string | null; hasToken: boolean } | null;
}

type Action = "check" | "syncTemplates" | "disconnect";

const QUALITY_TONE: Record<string, AdminTone> = { GREEN: "emerald", YELLOW: "amber", RED: "rose" };

export function TenantWhatsAppPanel({ tenantId }: { tenantId: string }) {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const { data, isLoading, isError } = useQuery<WaData>({
    queryKey: ["admin", "tenant", tenantId, "whatsapp"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/tenants/${tenantId}/whatsapp`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Failed to load WhatsApp details");
      return json.data as WaData;
    },
  });

  const act = useMutation({
    mutationFn: async (vars: { action: Action; integrationId?: string; businessId?: string }) => {
      const res = await fetch(`/api/admin/tenants/${tenantId}/whatsapp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vars),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Request failed");
      return json.data as Record<string, unknown>;
    },
    onSuccess: (result, vars) => {
      const text =
        vars.action === "check"
          ? "Connection works — details refreshed from Meta."
          : vars.action === "syncTemplates"
            ? `Templates synced: ${result.created ?? 0} new, ${result.updated ?? 0} updated.`
            : "Number disconnected.";
      setNotice({ tone: "ok", text });
      queryClient.invalidateQueries({ queryKey: ["admin", "tenant", tenantId] });
    },
    onError: (err: Error) => setNotice({ tone: "error", text: err.message }),
  });

  const pendingFor = (action: Action, key?: string) =>
    act.isPending && act.variables?.action === action && (act.variables.integrationId ?? act.variables.businessId) === key;

  const businesses = data?.businesses ?? [];
  const connected = businesses.flatMap((b) => b.numbers).filter((n) => n.isActive).length;

  return (
    <AdminPanel
      title="WhatsApp"
      subtitle={isLoading ? "Loading…" : `${connected} connected number${connected === 1 ? "" : "s"}`}
    >
      {notice && (
        <p
          role="status"
          className={
            notice.tone === "ok"
              ? "mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800"
              : "mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"
          }
        >
          {notice.text}
        </p>
      )}

      {isLoading ? (
        <AdminSkeletonRows rows={3} />
      ) : isError ? (
        <p className="text-sm text-rose-700">Couldn&apos;t load WhatsApp details.</p>
      ) : businesses.length === 0 ? (
        <p className="text-sm text-slate-500">This account has no businesses yet.</p>
      ) : (
        <div className="space-y-5">
          {businesses.map((b) => (
            <section key={b.id} className="rounded-lg border border-slate-200">
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5 sm:px-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{b.name}</p>
                  <p className="text-xs text-slate-500">
                    Templates: {b.templates.approved} approved · {b.templates.inReview} in review · {b.templates.other} other
                  </p>
                </div>
                <AdminButton
                  size="sm"
                  variant="secondary"
                  disabled={act.isPending || !b.numbers.some((n) => n.isActive)}
                  onClick={() => {
                    setNotice(null);
                    act.mutate({ action: "syncTemplates", businessId: b.id });
                  }}
                  title={b.numbers.some((n) => n.isActive) ? undefined : "Connect a number first"}
                >
                  {pendingFor("syncTemplates", b.id) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Re-sync templates
                </AdminButton>
              </header>

              {b.numbers.length === 0 && !b.legacy ? (
                <p className="px-3 py-3 text-sm text-slate-500 sm:px-4">No WhatsApp number connected.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {b.numbers.map((n) => (
                    <li key={n.id} className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-4">
                      <div className="min-w-0 space-y-1">
                        <p className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium text-slate-900">{n.phoneNumber ?? "Number"}</span>
                          {n.displayName && <span className="text-sm text-slate-500">{n.displayName}</span>}
                          <AdminBadge tone={n.isActive ? "emerald" : "slate"}>
                            {n.isActive ? <><CheckCircle2 className="h-3 w-3" /> Connected</> : "Disconnected"}
                          </AdminBadge>
                          {n.isDefault && n.isActive && <AdminBadge tone="sky">Default</AdminBadge>}
                          {n.qualityRating && (
                            <AdminBadge tone={QUALITY_TONE[n.qualityRating.toUpperCase()] ?? "slate"}>
                              Quality {n.qualityRating.toLowerCase()}
                            </AdminBadge>
                          )}
                        </p>
                        <dl className="grid grid-cols-1 gap-x-4 gap-y-0.5 text-xs text-slate-500 sm:grid-cols-2">
                          <div className="min-w-0 truncate">Phone number ID: <span className="font-mono text-slate-700">{n.phoneNumberId}</span></div>
                          <div className="min-w-0 truncate">WABA ID: <span className="font-mono text-slate-700">{n.whatsappBusinessId ?? "—"}</span></div>
                          <div>Connected {formatDate(n.createdAt)}</div>
                          <div>
                            {n.conversations.toLocaleString()} chats · last message{" "}
                            {n.lastMessageAt ? timeAgo(n.lastMessageAt) : "never"}
                          </div>
                          {n.codeVerificationStatus && <div>Verification: {n.codeVerificationStatus.toLowerCase().replace(/_/g, " ")}</div>}
                          <div className="sm:col-span-2">
                            <TokenState number={n} tenantId={tenantId} onError={(text) => setNotice({ tone: "error", text })} />
                          </div>
                        </dl>
                      </div>
                      {n.isActive && (
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <AdminButton
                            size="sm"
                            variant="secondary"
                            disabled={act.isPending}
                            onClick={() => {
                              setNotice(null);
                              act.mutate({ action: "check", integrationId: n.id });
                            }}
                          >
                            {pendingFor("check", n.id) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlugZap className="h-3.5 w-3.5" />}
                            Check connection
                          </AdminButton>
                          <AdminButton
                            size="sm"
                            variant="ghost"
                            className="text-rose-600 hover:text-rose-700"
                            disabled={act.isPending}
                            onClick={() => {
                              if (!confirm(`Disconnect ${n.phoneNumber ?? "this number"}? The account stops sending and receiving on it until it reconnects through Meta.`)) return;
                              setNotice(null);
                              act.mutate({ action: "disconnect", integrationId: n.id });
                            }}
                          >
                            {pendingFor("disconnect", n.id) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unplug className="h-3.5 w-3.5" />}
                            Disconnect
                          </AdminButton>
                        </div>
                      )}
                    </li>
                  ))}
                  {b.legacy && (
                    <li className="px-3 py-3 text-xs text-slate-600 sm:px-4">
                      <AdminBadge tone="amber">Old-style setup</AdminBadge>{" "}
                      {b.legacy.phoneNumber ?? "A number"} (ID <span className="font-mono">{b.legacy.phoneNumberId}</span>) is saved in
                      the business settings{b.legacy.hasToken ? " with a token" : " without a token"}, but not as a connected number.
                      It still sends; reconnecting it through Meta in the account&apos;s Settings moves it here.
                    </li>
                  )}
                </ul>
              )}
            </section>
          ))}

          {data?.accountSettings && (
            <p className="text-xs text-slate-500">
              <AdminBadge tone="amber">Old-style setup</AdminBadge> Account settings also hold phone number ID{" "}
              <span className="font-mono">{data.accountSettings.phoneNumberId}</span>
              {data.accountSettings.hasToken ? " with a token" : " without a token"} — used only as a last fallback.
            </p>
          )}
        </div>
      )}
    </AdminPanel>
  );
}

/**
 * Whether this number's credentials are usable, and a way to read the token.
 *
 * The hint is the last few characters — enough to match a token against the one in a
 * customer's screenshot without putting the credential on screen for everyone walking
 * past. Reading the whole thing is a separate click, and the server records it.
 */
function TokenState({
  number,
  tenantId,
  onError,
}: {
  number: WaNumber;
  tenantId: string;
  onError: (text: string) => void;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function reveal() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/whatsapp/${number.id}/reveal-token`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Couldn't read that token");
      setToken((json.data ?? json).token);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (!number.hasToken) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-amber-700">
        <KeyRound className="h-3.5 w-3.5" />
        No access token stored — this number cannot send.
      </span>
    );
  }

  if (!number.tokenReadable) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-rose-700">
        <KeyRound className="h-3.5 w-3.5" />
        Token stored but unreadable — it likely predates the current encryption key.
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
        <KeyRound className="h-3.5 w-3.5 text-slate-400" />
        Token <span className="font-mono text-slate-700">{number.tokenHint}</span>
        {number.hasAppSecret && <span className="text-slate-400">· app secret stored</span>}
      </span>

      {token ? (
        <code className="min-w-0 max-w-full break-all rounded bg-slate-900 px-2 py-1 font-mono text-[11px] text-emerald-300">
          {token}
        </code>
      ) : (
        <button
          type="button"
          onClick={reveal}
          disabled={loading}
          className="rounded-full border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
        >
          {loading ? "Reading…" : "Reveal"}
        </button>
      )}
    </div>
  );
}
