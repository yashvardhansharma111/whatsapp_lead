"use client";

import { Card, Skeleton } from "@/components/ui";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Circle, Code2, Copy, ExternalLink,
  Key, Plus, RefreshCw, Trash2, Webhook, XCircle,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { CardHead, SettingsIntro } from "@/components/settings/SettingsPrimitives";
import { CodeBlock, MethodPill, type HttpMethod } from "@/components/settings/CodeBlock";

/** What the public API exposes, as a glance rather than a document. */
const API_SURFACE: { method: HttpMethod; path: string; what: string }[] = [
  { method: "GET",  path: "/v1/templates", what: "approved templates" },
  { method: "GET",  path: "/v1/contacts",  what: "search and page" },
  { method: "POST", path: "/v1/contacts",  what: "create one" },
  { method: "POST", path: "/v1/messages",  what: "send a message" },
];

const API_EXAMPLES: { title: string; method: HttpMethod; path: string; code: string }[] = [
  {
    title: "Send a text message",
    method: "POST",
    path: "/v1/messages",
    code: `curl -X POST https://api.example.com/v1/messages \
  -H "X-Api-Key: <your_api_key>" \
  -H "Content-Type: application/json" \
  -d '{ "to": "+919876543210", "text": "Hello!" }'`,
  },
  {
    title: "Send a template message",
    method: "POST",
    path: "/v1/messages",
    code: `{
  "to": "+919876543210",
  "templateName": "order_confirmed",
  "variables": { "body": ["ORD-123", "₹500"] }
}`,
  },
  {
    title: "Find a contact",
    method: "GET",
    path: "/v1/contacts?search=rahul&page=1",
    code: `curl https://api.example.com/v1/contacts?search=rahul \
  -H "X-Api-Key: <your_api_key>"`,
  },
  {
    title: "Create a contact",
    method: "POST",
    path: "/v1/contacts",
    code: `{ "name": "Rahul", "phone": "+919876543210" }`,
  },
  {
    title: "List approved templates",
    method: "GET",
    path: "/v1/templates?search=order",
    code: `curl https://api.example.com/v1/templates?search=order \
  -H "X-Api-Key: <your_api_key>"`,
  },
];

const WEBHOOK_EVENTS = [
  { key: "campaign.completed", label: "Campaign Completed" },
  { key: "campaign.failed", label: "Campaign Failed" },
  { key: "message.received", label: "Message Received" },
  { key: "contact.created", label: "Contact Created" },
  { key: "contact.updated", label: "Contact Updated" },
  { key: "broadcast.completed", label: "Broadcast Completed" },
];

interface Endpoint {
  id: string;
  url: string;
  description: string | null;
  events: string[];
  isActive: boolean;
  createdAt: string;
  _count: { deliveries: number };
}

interface Delivery {
  id: string;
  event: string;
  statusCode: number | null;
  error: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

// ── API key section ──────────────────────────────────────────────────────────

function ApiKeySection() {
  const { showToast } = useToast();
  const qc = useQueryClient();
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  const { data } = useQuery<{ hasKey: boolean; maskedKey: string | null; planAllows: boolean }>({
    queryKey: ["webhooks-apikey"],
    queryFn: () => fetch("/api/webhooks/apikey").then((r) => r.json()),
  });

  const generate = useMutation({
    mutationFn: () => fetch("/api/webhooks/apikey", { method: "POST" }).then((r) => r.json()),
    onSuccess: (res) => {
      if (res.success) {
        setRevealedKey(res.apiKey);
        qc.invalidateQueries({ queryKey: ["webhooks-apikey"] });
        showToast("New API key generated. Copy it now — it won't be shown again.", "success");
      } else {
        showToast(res.error ?? "Failed to generate key", "error");
      }
    },
  });

  const revoke = useMutation({
    mutationFn: () => fetch("/api/webhooks/apikey", { method: "DELETE" }).then((r) => r.json()),
    onSuccess: (res) => {
      if (res.success) {
        setRevealedKey(null);
        qc.invalidateQueries({ queryKey: ["webhooks-apikey"] });
        showToast("API key revoked.", "info");
      } else {
        showToast(res.error ?? "Failed to revoke", "error");
      }
    },
  });

  function copyKey() {
    if (!revealedKey) return;
    navigator.clipboard.writeText(revealedKey).then(() => showToast("Copied!", "success"));
  }

  const displayKey = revealedKey ?? data?.maskedKey;

  return (
    <Card className="p-4 transition-shadow hover:shadow-md sm:p-5">
      <CardHead
        icon={Key}
        tone="amber"
        title="API key"
        description="One secret, sent as the X-Api-Key header, that lets your own code act in this workspace."
      />
      <div className="mt-4 space-y-4">

      {data && !data.planAllows && (
        <div className="flex items-start gap-2.5 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <span>
            Your plan does not include API access. Upgrade to one with the{" "}
            <strong className="font-semibold">API Access</strong> feature to generate a key.
          </span>
        </div>
      )}

      <div className="space-y-1.5">
        {API_SURFACE.map((e) => (
          <div key={`${e.method}${e.path}`} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-2 ring-1 ring-inset ring-slate-200/70">
            <MethodPill method={e.method} />
            <code className="min-w-0 flex-1 truncate font-mono text-xs text-slate-700">{e.path}</code>
            <span className="hidden shrink-0 text-[11px] text-slate-400 sm:inline">{e.what}</span>
          </div>
        ))}
      </div>

      {displayKey ? (
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 break-all rounded-lg bg-slate-900 px-3 py-2.5 font-mono text-xs text-emerald-300 ring-1 ring-inset ring-slate-900/10">
            {displayKey}
          </code>
          {revealedKey && (
            <button
              onClick={copyKey}
              className="rounded-md border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              title="Copy key"
            >
              <Copy className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : null}

      {revealedKey && (
        <p className="flex items-start gap-1.5 text-xs text-amber-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Copy it now. Leaving this page is the last you will see of it.
        </p>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          onClick={() => generate.mutate()}
          disabled={generate.isPending || data?.planAllows === false}
          title={data?.planAllows === false ? "Upgrade your plan to use API access" : undefined}
          className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${generate.isPending ? "animate-spin" : ""}`} />
          {data?.hasKey ? "Regenerate" : "Generate Key"}
        </button>
        {data?.hasKey && (
          <button
            onClick={() => revoke.mutate()}
            disabled={revoke.isPending}
            className="flex items-center gap-1.5 rounded-md border border-rose-200 px-3 py-1.5 text-sm text-rose-600 hover:bg-rose-50 disabled:opacity-60"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Revoke
          </button>
        )}
      </div>
      </div>
    </Card>
  );
}

// ── Endpoint row ─────────────────────────────────────────────────────────────

function EndpointRow({
  ep,
  onDelete,
  onToggle,
}: {
  ep: Endpoint;
  onDelete: (id: string) => void;
  onToggle: (id: string, active: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const { data: detail } = useQuery<{ deliveries: Delivery[] }>({
    queryKey: ["webhook-deliveries", ep.id],
    queryFn: () => fetch(`/api/webhooks/${ep.id}/deliveries`).then((r) => r.json()),
    enabled: open,
  });

  return (
    <div className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200 transition hover:ring-slate-300">
      <div className="flex items-start gap-3 p-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex h-2 w-2 rounded-full ${ep.isActive ? "bg-emerald-500" : "bg-slate-300"}`}
            />
            <span className="font-mono text-sm text-slate-800 truncate">{ep.url}</span>
          </div>
          {ep.description && (
            <p className="mt-0.5 text-xs text-slate-500">{ep.description}</p>
          )}
          <div className="mt-1.5 flex flex-wrap gap-1">
            {ep.events.map((e) => (
              <span
                key={e}
                className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
              >
                {e}
              </span>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => onToggle(ep.id, !ep.isActive)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${ep.isActive ? "bg-slate-100 text-slate-600 hover:bg-slate-200" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}`}
          >
            {ep.isActive ? "Disable" : "Enable"}
          </button>
          <button
            onClick={() => onDelete(ep.id)}
            className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
            title="Delete endpoint"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setOpen((v) => !v)}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"
            title="Delivery log"
          >
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-slate-200 p-4">
          <p className="mb-2 text-xs font-medium text-slate-500 uppercase tracking-wide">Last 20 deliveries</p>
          {!detail?.deliveries?.length ? (
            <p className="text-sm text-slate-400">No deliveries yet.</p>
          ) : (
            <div className="space-y-1">
              {detail.deliveries.map((d) => (
                <div key={d.id} className="flex items-center gap-3 rounded px-2 py-1.5 hover:bg-slate-50">
                  {d.deliveredAt ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  ) : d.error ? (
                    <XCircle className="h-3.5 w-3.5 shrink-0 text-rose-500" />
                  ) : (
                    <Circle className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                  )}
                  <span className="font-mono text-xs text-slate-500 shrink-0">
                    {d.statusCode ?? "—"}
                  </span>
                  <span className="text-xs text-slate-600 flex-1 truncate">{d.event}</span>
                  {d.error && (
                    <span className="text-xs text-rose-500 truncate max-w-[160px]">{d.error}</span>
                  )}
                  <span className="text-xs text-slate-400 shrink-0">
                    {new Date(d.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Add endpoint form ────────────────────────────────────────────────────────

function AddEndpointForm({ onAdded }: { onAdded: () => void }) {
  const { showToast } = useToast();
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [events, setEvents] = useState<string[]>([]);
  const [revealSecret, setRevealSecret] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: (body: object) =>
      fetch("/api/webhooks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()),
    onSuccess: (res) => {
      if (res.success) {
        setRevealSecret(res.endpoint.secret);
        setUrl("");
        setDescription("");
        setEvents([]);
        showToast("Webhook endpoint added.", "success");
        onAdded();
      } else {
        showToast(res.error ?? "Failed to add endpoint", "error");
      }
    },
  });

  function toggle(e: string) {
    setEvents((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]));
  }

  function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!url) { showToast("URL is required", "error"); return; }
    if (!events.length) { showToast("Select at least one event", "error"); return; }
    create.mutate({ url, description, events });
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-slate-200 p-5 space-y-4">
      <h3 className="font-medium text-slate-800">Add Endpoint</h3>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">URL</label>
        <input
          type="url"
          placeholder="https://your-crm.com/webhooks/whatscrm"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Description (optional)</label>
        <input
          type="text"
          placeholder="e.g. My CRM webhook"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Events to subscribe</label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {WEBHOOK_EVENTS.map((ev) => (
            <label key={ev.key} className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={events.includes(ev.key)}
                onChange={() => toggle(ev.key)}
                className="h-3.5 w-3.5 accent-emerald-600"
              />
              <span className="text-sm text-slate-700">{ev.label}</span>
            </label>
          ))}
        </div>
      </div>

      {revealSecret && (
        <div className="rounded-lg bg-amber-50 p-3 ring-1 ring-inset ring-amber-200">
          <p className="mb-2 flex items-start gap-1.5 text-xs font-medium text-amber-900">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
            Signing secret — copy it now, it is not shown again.
          </p>
          <code className="block break-all rounded-lg bg-slate-900 px-3 py-2.5 font-mono text-xs text-amber-300">
            {revealSecret}
          </code>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(revealSecret);
              showToast("Secret copied!", "success");
            }}
            className="mt-2 flex items-center gap-1 text-xs text-amber-700 hover:underline"
          >
            <Copy className="h-3 w-3" /> Copy
          </button>
        </div>
      )}

      <button
        type="submit"
        disabled={create.isPending}
        className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        <Plus className="h-4 w-4" />
        {create.isPending ? "Adding…" : "Add Endpoint"}
      </button>
    </form>
  );
}

// ── Main tab ─────────────────────────────────────────────────────────────────

export function WebhooksTab() {
  const { showToast } = useToast();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);

  const { data, isLoading } = useQuery<{ endpoints: Endpoint[] }>({
    queryKey: ["webhook-endpoints"],
    queryFn: () => fetch("/api/webhooks").then((r) => r.json()),
  });

  const deleteEp = useMutation({
    mutationFn: (id: string) => fetch(`/api/webhooks/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: (res, id) => {
      if (res.success) {
        qc.setQueryData<{ endpoints: Endpoint[] }>(["webhook-endpoints"], (old) =>
          old ? { ...old, endpoints: old.endpoints.filter((e) => e.id !== id) } : old,
        );
        showToast("Endpoint removed.", "info");
      } else {
        showToast(res.error ?? "Failed to delete", "error");
      }
    },
  });

  const toggleEp = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      fetch(`/api/webhooks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      }).then((r) => r.json()),
    onSuccess: (res) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ["webhook-endpoints"] });
      } else {
        showToast(res.error ?? "Failed to update", "error");
      }
    },
  });

  return (
    <div className="space-y-6">
      <SettingsIntro icon={Webhook} title="Wire this up to your own systems" storageKey="webhooks">
        Outgoing webhooks push events to your CRM the moment they happen. The incoming API goes the
        other way, letting your own code send messages and manage contacts here.
      </SettingsIntro>

      <ApiKeySection />

      <Card className="p-4 transition-shadow hover:shadow-md sm:p-5">
        <CardHead
          icon={Webhook}
          tone="blue"
          title={`Outgoing webhooks${data?.endpoints?.length ? ` (${data.endpoints.length})` : ""}`}
          description="We POST to your URL the moment a chosen event happens, signed so you can prove it came from us."
          action={
            <button
              onClick={() => setShowAdd((v) => !v)}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
            >
              <Plus className="h-3.5 w-3.5" />
              Add endpoint
            </button>
          }
        />

        <div className="mt-4 space-y-4">
        <p className="text-sm leading-relaxed text-slate-500">
          Check the <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">X-Webhook-Signature</code>{" "}
          header against an HMAC-SHA256 of the raw body, keyed with that endpoint&apos;s secret.
        </p>

        {showAdd && (
          <div className="mb-4">
            <AddEndpointForm
              onAdded={() => {
                qc.invalidateQueries({ queryKey: ["webhook-endpoints"] });
                setShowAdd(false);
              }}
            />
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : !data?.endpoints?.length ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-10 text-center">
            <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-400 ring-1 ring-slate-200">
              <Webhook className="h-5 w-5" />
            </span>
            <p className="mt-3 text-sm font-medium text-slate-700">Nothing is listening yet</p>
            <p className="mt-1 text-xs text-slate-500">Add a URL and we will post your events to it as they happen.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.endpoints.map((ep) => (
              <EndpointRow
                key={ep.id}
                ep={ep}
                onDelete={(id) => deleteEp.mutate(id)}
                onToggle={(id, active) => toggleEp.mutate({ id, isActive: active })}
              />
            ))}
          </div>
        )}
        </div>
      </Card>

      <Card className="p-4 transition-shadow hover:shadow-md sm:p-5">
        <CardHead
          icon={Code2}
          tone="slate"
          title="Calling us"
          description="Every request takes your API key in the X-Api-Key header."
          action={
            <a
              href="/api-docs"
              target="_blank"
              rel="noopener noreferrer"
              className="flex shrink-0 items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-50"
            >
              Full docs <ExternalLink className="h-3 w-3" />
            </a>
          }
        />

        <div className="mt-4 space-y-4">
          {API_EXAMPLES.map((ex) => (
            <div key={ex.title}>
              <p className="mb-1.5 text-sm font-medium text-slate-800">{ex.title}</p>
              <CodeBlock method={ex.method} path={ex.path} code={ex.code} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
