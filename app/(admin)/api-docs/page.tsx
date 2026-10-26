"use client";

import { useState } from "react";
import { Copy, CheckCheck } from "lucide-react";
import { Card } from "@/components/ui";
import { cn } from "@/lib/utils";

// ─── Code block with copy ──────────────────────────────────────────────────────

function CodeBlock({ code, lang = "http" }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="group relative rounded-lg border border-slate-200 bg-slate-50">
      <button
        onClick={copy}
        className="absolute right-2 top-2 rounded p-1 text-slate-400 opacity-0 transition hover:text-slateald-700 group-hover:opacity-100"
        title="Copy"
      >
        {copied ? <CheckCheck className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
      <pre className="overflow-x-auto p-4 text-xs leading-relaxed text-slate-700 whitespace-pre">{code}</pre>
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({ id, title, badge, children }: { id: string; title: string; badge?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {badge && (
          <span className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            badge === "GET"    ? "bg-sky-100 text-sky-700" :
            badge === "POST"   ? "bg-emerald-100 text-emerald-700" :
            badge === "DELETE" ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600",
          )}>
            {badge}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const BASE = "https://api.waboxa.com";

export default function ApiDocsPage() {
  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Public REST API</h1>
        <p className="mt-1 text-sm text-slate-500">
          Reference for the tenant-facing <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono">/v1</code> API.
          Clients generate their key from <strong>Settings → Webhooks &amp; API</strong>.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        {/* Sticky nav */}
        <nav className="hidden lg:block">
          <div className="sticky top-6 space-y-1 text-sm">
            {[
              { href: "#auth",      label: "Authentication" },
              { href: "#plan",      label: "Plan gating" },
              { href: "#templates", label: "GET /v1/templates" },
              { href: "#contacts-list", label: "GET /v1/contacts" },
              { href: "#contacts-create", label: "POST /v1/contacts" },
              { href: "#messages",  label: "POST /v1/messages" },
              { href: "#errors",    label: "Error reference" },
            ].map((n) => (
              <a
                key={n.href}
                href={n.href}
                className="block truncate rounded px-2.5 py-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              >
                {n.label}
              </a>
            ))}
          </div>
        </nav>

        {/* Docs body */}
        <div className="min-w-0 space-y-10">

          {/* Authentication */}
          <Section id="auth" title="Authentication">
            <p className="text-sm text-slate-600">
              Every request must include the tenant&apos;s API key in the <code className="rounded bg-slate-100 px-1 py-0.5 text-xs font-mono">X-Api-Key</code> header.
              Keys are generated per-tenant from <strong>Settings → Webhooks &amp; API</strong> and are never shown again after creation.
            </p>
            <CodeBlock code={`curl ${BASE}/v1/templates \\
  -H "X-Api-Key: abc123..."`} />
          </Section>

          {/* Plan gating */}
          <Section id="plan" title="Plan gating">
            <Card className="border-amber-100 bg-amber-50 p-4">
              <p className="text-sm text-amber-800">
                API access requires the <strong>api_access</strong> feature on the tenant&apos;s active plan.
                If not enabled, the guard returns <code className="rounded bg-amber-100 px-1 text-xs font-mono">403 Forbidden</code> with:
              </p>
              <CodeBlock code={`{ "statusCode": 403, "message": "API access is not enabled on your current plan. Please upgrade." }`} />
            </Card>
            <p className="text-sm text-slate-600">
              To enable for a plan: go to <strong>Admin → Plans</strong>, edit the plan, and add <code className="rounded bg-slate-100 px-1 text-xs font-mono">api_access</code> to the features array.
            </p>
          </Section>

          {/* GET /v1/templates */}
          <Section id="templates" title="List approved templates" badge="GET">
            <p className="text-sm font-mono text-slate-500">{BASE}/v1/templates</p>
            <p className="text-sm text-slate-600">Returns all APPROVED message templates for the tenant.</p>
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Query params</p>
              <table className="w-full text-left text-xs">
                <thead className="text-slate-400">
                  <tr><th className="pb-1 pr-4 font-medium">Param</th><th className="pb-1 font-medium">Description</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  <tr><td className="py-1.5 pr-4 font-mono">search</td><td>Filter by template name (partial, case-insensitive)</td></tr>
                </tbody>
              </table>
            </div>
            <CodeBlock code={`GET /v1/templates?search=order
X-Api-Key: <your_api_key>

# Response
[
  {
    "id": "cuid...",
    "name": "order_confirmed",
    "language": "en",
    "status": "APPROVED",
    "category": "UTILITY",
    ...
  }
]`} />
          </Section>

          {/* GET /v1/contacts */}
          <Section id="contacts-list" title="List contacts" badge="GET">
            <p className="text-sm font-mono text-slate-500">{BASE}/v1/contacts</p>
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Query params</p>
              <table className="w-full text-left text-xs">
                <thead className="text-slate-400">
                  <tr><th className="pb-1 pr-4 font-medium">Param</th><th className="pb-1 font-medium">Description</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  <tr><td className="py-1.5 pr-4 font-mono">page</td><td>Page number (default 1)</td></tr>
                  <tr><td className="py-1.5 pr-4 font-mono">limit</td><td>Per-page count (max 100, default 50)</td></tr>
                  <tr><td className="py-1.5 pr-4 font-mono">search</td><td>Filter by name or phone</td></tr>
                </tbody>
              </table>
            </div>
            <CodeBlock code={`GET /v1/contacts?search=rahul&page=1&limit=20
X-Api-Key: <your_api_key>

# Response
{ "contacts": [...], "total": 42, "page": 1, "limit": 20 }`} />
          </Section>

          {/* POST /v1/contacts */}
          <Section id="contacts-create" title="Create / upsert contact" badge="POST">
            <p className="text-sm font-mono text-slate-500">{BASE}/v1/contacts</p>
            <p className="text-sm text-slate-600">
              Creates a new contact or updates an existing one (matched by <code className="rounded bg-slate-100 px-1 text-xs font-mono">phone</code>).
            </p>
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Body</p>
              <table className="w-full text-left text-xs">
                <thead className="text-slate-400">
                  <tr><th className="pb-1 pr-4 font-medium">Field</th><th className="pb-1 pr-4 font-medium">Required</th><th className="pb-1 font-medium">Description</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  <tr><td className="py-1.5 pr-4 font-mono">phone</td><td className="pr-4 text-rose-600">yes</td><td>E.164 format e.g. +919876543210</td></tr>
                  <tr><td className="py-1.5 pr-4 font-mono">name</td><td className="pr-4 text-rose-600">yes</td><td>Full name</td></tr>
                  <tr><td className="py-1.5 pr-4 font-mono">email</td><td className="pr-4 text-slate-400">no</td><td>Email address</td></tr>
                  <tr><td className="py-1.5 pr-4 font-mono">company</td><td className="pr-4 text-slate-400">no</td><td>Company name</td></tr>
                  <tr><td className="py-1.5 pr-4 font-mono">source</td><td className="pr-4 text-slate-400">no</td><td>Tag for origin (default: "api")</td></tr>
                </tbody>
              </table>
            </div>
            <CodeBlock code={`POST /v1/contacts
X-Api-Key: <your_api_key>
Content-Type: application/json

{
  "phone": "+919876543210",
  "name": "Rahul Sharma",
  "email": "rahul@example.com",
  "company": "Acme Corp"
}`} />
          </Section>

          {/* POST /v1/messages */}
          <Section id="messages" title="Send a message" badge="POST">
            <p className="text-sm font-mono text-slate-500">{BASE}/v1/messages</p>
            <p className="text-sm text-slate-600">
              Sends a text or template message to an existing contact. The contact must exist — create it
              first via <code className="rounded bg-slate-100 px-1 text-xs font-mono">POST /v1/contacts</code> if needed.
            </p>
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Body — text message</p>
              <CodeBlock code={`POST /v1/messages
X-Api-Key: <your_api_key>
Content-Type: application/json

{ "to": "+919876543210", "text": "Hello from the API!" }`} />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Body — template message</p>
              <CodeBlock code={`POST /v1/messages
X-Api-Key: <your_api_key>
Content-Type: application/json

{
  "to": "+919876543210",
  "templateName": "order_confirmed",
  "variables": {
    "body": ["ORD-4521", "₹1,200"]
  }
}`} />
              <p className="text-xs text-slate-500">
                <code className="rounded bg-slate-100 px-1 font-mono">variables.body</code> — array of body variable substitutions in order ({{"{{"}}1{{"}}"}}, {{"{{"}}2{{"}}"}}, …).
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Response</p>
              <CodeBlock code={`{ "messageId": "cuid...", "waMessageId": "wamid.xxx" }`} />
            </div>
          </Section>

          {/* Error reference */}
          <Section id="errors" title="Error reference">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-400">
                <tr>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Cause</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                <tr><td className="px-3 py-2 font-mono">401</td><td className="px-3 py-2">Missing or invalid <code className="rounded bg-slate-100 px-0.5 font-mono">X-Api-Key</code></td></tr>
                <tr><td className="px-3 py-2 font-mono">403</td><td className="px-3 py-2">Plan does not include <code className="rounded bg-slate-100 px-0.5 font-mono">api_access</code> feature</td></tr>
                <tr><td className="px-3 py-2 font-mono">400</td><td className="px-3 py-2">Missing required fields in request body</td></tr>
                <tr><td className="px-3 py-2 font-mono">200 + error</td><td className="px-3 py-2">Business-logic error (contact not found, template not approved, WhatsApp API error) — check the <code className="rounded bg-slate-100 px-0.5 font-mono">error</code> field in the response body</td></tr>
              </tbody>
            </table>
          </Section>

        </div>
      </div>
    </div>
  );
}
