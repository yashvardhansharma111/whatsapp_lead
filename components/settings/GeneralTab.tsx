"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Building2, ImagePlus, Mail, Save } from "lucide-react";
import { Button, Card, Field, SkeletonCard, inputClass } from "@/components/ui";
import { CardHead, SettingsIntro } from "@/components/settings/SettingsPrimitives";
import { cn } from "@/lib/utils";

const TIMEZONES = [
  "Asia/Kolkata", "Asia/Dubai", "Asia/Singapore",
  "Europe/London", "America/New_York", "America/Los_Angeles",
];

type SocialLinks = {
  facebook:  string;
  instagram: string;
  twitter:   string;
  linkedin:  string;
  website:   string;
};

type SettingsData = {
  tenant: { name: string; slug: string; logo?: string; domain?: string };
  timezone: string;
  socialLinks?: SocialLinks;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpUser?: string | null;
  smtpFrom?: string | null;
  /** A password is stored; its value is never sent back. */
  smtpPassSet?: boolean;
};

type CategoryData = {
  category: { id: string; name: string } | null;
  categories: { id: string; name: string }[];
};

export function GeneralTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<SettingsData>({
    queryKey: ["settings"],
    queryFn: async () => {
      const r = await fetch("/api/settings");
      const j = await r.json();
      return j.data;
    },
  });

  const { data: categoryData } = useQuery<CategoryData>({
    queryKey: ["account-category"],
    queryFn: async () => {
      const r = await fetch("/api/account/category");
      const j = await r.json();
      return j.data;
    },
  });

  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [domain, setDomain] = useState("");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpFrom, setSmtpFrom] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saved, setSaved] = useState(false);

  // Social links
  const [facebook,  setFacebook]  = useState("");
  const [instagram, setInstagram] = useState("");
  const [twitter,   setTwitter]   = useState("");
  const [linkedin,  setLinkedin]  = useState("");
  const [website,   setWebsite]   = useState("");

  // Seeded from the server during render rather than in an effect. An effect
  // re-ran on every refetch, so a background refresh silently discarded whatever
  // the user had typed and not yet saved; the sentinel seeds once, and the three
  // fields are the user's from then on.
  const [seeded, setSeeded] = useState(false);
  if (data && !seeded) {
    setSeeded(true);
    setName(data.tenant?.name ?? "");
    setDomain(data.tenant?.domain ?? "");
    setTimezone(data.timezone ?? "Asia/Kolkata");
    setFacebook(data.socialLinks?.facebook   ?? "");
    setInstagram(data.socialLinks?.instagram ?? "");
    setTwitter(data.socialLinks?.twitter     ?? "");
    setLinkedin(data.socialLinks?.linkedin   ?? "");
    setWebsite(data.socialLinks?.website     ?? "");
    setSmtpHost(data.smtpHost ?? "");
    setSmtpPort(data.smtpPort ? String(data.smtpPort) : "587");
    setSmtpUser(data.smtpUser ?? "");
    setSmtpFrom(data.smtpFrom ?? "");
  }
  const [categorySeeded, setCategorySeeded] = useState(false);
  if (categoryData && !categorySeeded) {
    setCategorySeeded(true);
    setCategoryId(categoryData.category?.id ?? "");
  }
  // A category deactivated by the platform stays on accounts that already had it, so
  // keep it selectable here even though the active list no longer includes it.
  const categoryOptions = [
    ...(categoryData?.categories ?? []),
    ...(categoryData?.category && !categoryData.categories.some((c) => c.id === categoryData.category!.id)
      ? [categoryData.category]
      : []),
  ];

  const save = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantName: name,
          domain: domain || undefined,
          timezone,
          socialLinks: { facebook, instagram, twitter, linkedin, website },
          smtpHost: smtpHost.trim() || null,
          smtpPort: smtpPort.trim() ? Number(smtpPort) : null,
          smtpUser: smtpUser.trim() || null,
          smtpFrom: smtpFrom.trim() || null,
          // Blank leaves the stored password alone, so saving the rest of this form
          // does not wipe a value the field deliberately never shows.
          ...(smtpPass.trim() ? { smtpPass: smtpPass.trim() } : {}),
        }),
      });
      if (!r.ok) { const j = await r.json(); throw new Error(j.error ?? "Save failed"); }
      if (categoryData && categoryId !== (categoryData.category?.id ?? "")) {
        const c = await fetch("/api/account/category", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ categoryId: categoryId || null }),
        });
        if (!c.ok) { const j = await c.json(); throw new Error(j.error ?? "Could not save the business category"); }
      }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: ["account-category"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-5">
        <SkeletonCard lines={4} />
        <SkeletonCard lines={2} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SettingsIntro icon={Building2} title="How your business presents itself" storageKey="general">
        The name, logo and contact details your team sees in the app and your customers see on
        anything you send. Changing them here changes them everywhere at once.
      </SettingsIntro>

      <Card className="p-5 transition-shadow hover:shadow-md">
        <CardHead
          icon={Building2}
          title="Workspace"
          description="How your workspace appears to your team and your customers."
        />

        <div className="mt-5 flex flex-col gap-5 sm:flex-row">
          <div className="shrink-0">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Logo</span>
            <button
              type="button"
              className="flex h-28 w-28 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400 transition hover:border-emerald-400 hover:bg-emerald-50/40 hover:text-emerald-600"
            >
              <ImagePlus className="h-6 w-6" />
              <span className="text-xs font-medium">Upload</span>
            </button>
            <p className="mt-1.5 w-28 text-center text-[11px] text-slate-400">PNG or SVG, 1:1</p>
          </div>

          <div className="flex-1 space-y-4">
            <Field label="Workspace name" htmlFor="ws-name" required>
              <input
                id="ws-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
                placeholder="Acme Realty"
              />
            </Field>

            <Field label="Business category" htmlFor="ws-category">
              <select
                id="ws-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className={inputClass}
              >
                <option value="">— Select a category —</option>
                {categoryOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>

            <Field label="Custom domain" htmlFor="ws-domain">
              <input
                id="ws-domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className={inputClass}
                placeholder="crm.acmerealty.com"
              />
              <p className="mt-1.5 text-xs text-slate-500">
                Point a CNAME record at <code className="font-mono">{process.env.NEXT_PUBLIC_CNAME_TARGET ?? "cname.vercel-dns.com"}</code>, then contact support to activate it.
              </p>
            </Field>

            <Field label="Timezone" htmlFor="ws-tz">
              <select
                id="ws-tz"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className={inputClass}
              >
                {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </Field>
          </div>
        </div>

        {save.error && (
          <p className="mt-3 text-sm text-rose-600">{(save.error as Error).message}</p>
        )}

        <div className="mt-5 flex justify-end max-sm:[&>button]:h-10 max-sm:[&>button]:w-full border-t border-slate-100 pt-4">
          <Button onClick={() => save.mutate()} disabled={save.isPending || !name.trim()}>
            <Save className="h-4 w-4" />
            {save.isPending ? "Saving…" : saved ? "Saved!" : "Save Changes"}
          </Button>
        </div>
      </Card>

      <Card className="p-5 transition-shadow hover:shadow-md">
        <CardHead
          icon={Mail}
          tone="blue"
          title="Email delivery"
          description="The mail server used for messages this workspace sends, such as adding someone to the team."
        />
        <div className="mt-4 space-y-4">
          <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-600 ring-1 ring-inset ring-slate-200">
            Leave this empty to use the platform&apos;s own mail server. A reseller that sets its
            own is used for its customers too, so the message arrives in that brand&apos;s name
            rather than the platform&apos;s.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Server" htmlFor="smtp-host">
              <input
                id="smtp-host"
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
                className={inputClass}
                placeholder="smtp.yourprovider.com"
              />
            </Field>
            <Field label="Port" htmlFor="smtp-port">
              <input
                id="smtp-port"
                value={smtpPort}
                onChange={(e) => setSmtpPort(e.target.value.replace(/[^0-9]/g, ""))}
                className={inputClass}
                placeholder="587"
                inputMode="numeric"
              />
              <p className="mt-1 text-xs text-slate-500">587 for most providers, 465 for implicit TLS.</p>
            </Field>
            <Field label="Username" htmlFor="smtp-user">
              <input
                id="smtp-user"
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
                className={inputClass}
                autoComplete="off"
              />
            </Field>
            <Field label="Password" htmlFor="smtp-pass">
              <input
                id="smtp-pass"
                type="password"
                value={smtpPass}
                onChange={(e) => setSmtpPass(e.target.value)}
                className={inputClass}
                placeholder={data?.smtpPassSet ? "Stored — leave blank to keep it" : ""}
                autoComplete="new-password"
              />
            </Field>
          </div>

          <Field label="From address" htmlFor="smtp-from">
            <input
              id="smtp-from"
              value={smtpFrom}
              onChange={(e) => setSmtpFrom(e.target.value)}
              className={inputClass}
              placeholder="Your Company &lt;hello@yourcompany.com&gt;"
            />
            <p className="mt-1 text-xs text-slate-500">
              What recipients see as the sender. Most providers require it to match the account above.
            </p>
          </Field>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="font-semibold text-slate-900">Social Media Links</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Public social profiles for your business. These are displayed to your team and can be shared with contacts.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Facebook" htmlFor="sl-facebook">
            <input
              id="sl-facebook"
              type="url"
              value={facebook}
              onChange={(e) => setFacebook(e.target.value)}
              className={inputClass}
              placeholder="https://facebook.com/yourbusiness"
            />
          </Field>

          <Field label="Instagram" htmlFor="sl-instagram">
            <input
              id="sl-instagram"
              type="url"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              className={inputClass}
              placeholder="https://instagram.com/yourbusiness"
            />
          </Field>

          <Field label="Twitter / X" htmlFor="sl-twitter">
            <input
              id="sl-twitter"
              type="url"
              value={twitter}
              onChange={(e) => setTwitter(e.target.value)}
              className={inputClass}
              placeholder="https://x.com/yourbusiness"
            />
          </Field>

          <Field label="LinkedIn" htmlFor="sl-linkedin">
            <input
              id="sl-linkedin"
              type="url"
              value={linkedin}
              onChange={(e) => setLinkedin(e.target.value)}
              className={inputClass}
              placeholder="https://linkedin.com/company/yourbusiness"
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Website" htmlFor="sl-website">
              <input
                id="sl-website"
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className={inputClass}
                placeholder="https://yourbusiness.com"
              />
            </Field>
          </div>
        </div>
      </Card>

      <Card className="border-rose-300 p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-rose-700">Danger zone</h2>
            <p className="mt-0.5 text-sm text-slate-600">
              Deleting this workspace permanently removes every contact, conversation, lead and campaign. This cannot be undone.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={cn(inputClass, "sm:max-w-xs")}
                placeholder="Type DELETE to confirm"
                aria-label="Type DELETE to confirm"
              />
              <Button variant="danger" disabled={confirm !== "DELETE"}>Delete Workspace</Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
