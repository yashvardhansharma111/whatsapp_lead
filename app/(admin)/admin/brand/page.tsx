"use client";

// Super admin → the platform's own name, logo and icons.
//
// Every white-label reseller could change these from the start. The platform could not:
// its brand was a constant in the frontend with an environment variable in front of it,
// so the one account nobody could reconfigure without a deploy was the operator's own —
// including the icon in their own browser tab.

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import {
  AdminButton,
  AdminPageHeader,
  AdminPanel,
  AdminSkeletonRows,
  adminInputClass,
} from "@/components/admin/ui";
import { AssetInput } from "@/components/ui/AssetInput";
import { cn } from "@/lib/utils";

interface PlatformBrand {
  brandName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  appleIconUrl: string | null;
  ogImageUrl: string | null;
  themeColor: string | null;
  primaryColor: string;
  accentColor: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  website: string | null;
  address: string | null;
  loginHeadline: string | null;
  loginSubtext: string | null;
}

const EMPTY: PlatformBrand = {
  brandName: "", logoUrl: "", faviconUrl: "", appleIconUrl: "", ogImageUrl: "",
  themeColor: "", primaryColor: "#059669", accentColor: "", supportEmail: "",
  supportPhone: "", website: "", address: "", loginHeadline: "", loginSubtext: "",
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error ?? "That did not work");
  return (json.data ?? json) as T;
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export default function PlatformBrandPage() {
  const qc = useQueryClient();
  // Edits are held on their own and laid over what was loaded, rather than copied into
  // state by an effect — a copy goes stale the moment the query refetches, and syncing it
  // back is the bug that copy always invites.
  const [edits, setEdits] = useState<Partial<PlatformBrand>>({});
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "platform-brand"],
    queryFn: () => api<PlatformBrand | null>("/api/admin/platform-brand"),
  });

  const loaded = Object.fromEntries(
    Object.entries(data ?? {}).map(([k, v]) => [k, v ?? ""]),
  ) as Partial<PlatformBrand>;
  const form: PlatformBrand = { ...EMPTY, ...loaded, ...edits };

  const save = useMutation({
    mutationFn: () =>
      api("/api/admin/platform-brand", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }),
    onSuccess: () => {
      setSaved(true);
      setEdits({});
      qc.invalidateQueries({ queryKey: ["admin", "platform-brand"] });
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const set = (k: keyof PlatformBrand) => (v: string) =>
    setEdits((e) => ({ ...e, [k]: v }));

  if (isLoading) {
    return (
      <div>
        <AdminPageHeader title="Platform branding" description="Your own name, logo and icons." />
        <AdminSkeletonRows rows={6} />
      </div>
    );
  }

  const colour = /^#[0-9a-f]{6}$/i.test(form.primaryColor) ? form.primaryColor : "#059669";

  return (
    <div>
      <AdminPageHeader
        title="Platform branding"
        description="What your own product is called and what it looks like — the tab icon, the home-screen icon and the picture shown when someone shares your link."
        action={
          <AdminButton onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saved ? "Saved" : "Save"}
          </AdminButton>
        }
      />

      {save.isError && (
        <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {(save.error as Error).message}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <AdminPanel title="Name and colour">
          <div className="space-y-4">
            <Row label="Brand name" hint="Shown in the tab, in emails and on the sign-in page.">
              <input
                className={adminInputClass}
                value={form.brandName}
                maxLength={60}
                onChange={(e) => set("brandName")(e.target.value)}
              />
            </Row>
            <Row label="Primary colour" hint="The accent used across the app.">
              <div className="flex gap-2">
                <input
                  type="color"
                  value={colour}
                  onChange={(e) => set("primaryColor")(e.target.value)}
                  aria-label="Pick the primary colour"
                  className="h-9 w-12 shrink-0 cursor-pointer rounded-lg ring-1 ring-slate-200"
                />
                <input
                  className={cn(adminInputClass, "font-mono")}
                  value={form.primaryColor}
                  maxLength={7}
                  onChange={(e) => set("primaryColor")(e.target.value)}
                />
              </div>
            </Row>
            <Row label="Theme colour" hint="Browser chrome and the installed app. Blank uses the primary colour.">
              <input
                className={cn(adminInputClass, "font-mono")}
                value={form.themeColor ?? ""}
                placeholder={colour}
                maxLength={7}
                onChange={(e) => set("themeColor")(e.target.value)}
              />
            </Row>
          </div>
        </AdminPanel>

        <AdminPanel title="Icons">
          <div className="space-y-4">
            <Row label="Logo" hint="Shown in the app and on the sign-in page.">
              <AssetInput id="p-logo" value={form.logoUrl ?? ""} onChange={set("logoUrl")} placeholder="https://…/logo.png" />
            </Row>
            <Row label="Favicon" hint="The icon in the browser tab. 32×32 or larger, PNG or ICO.">
              <AssetInput id="p-favicon" value={form.faviconUrl ?? ""} onChange={set("faviconUrl")} placeholder="https://…/favicon.png" />
            </Row>
            <Row label="Home-screen icon" hint="180×180 PNG, for an iPhone home screen.">
              <AssetInput id="p-apple" value={form.appleIconUrl ?? ""} onChange={set("appleIconUrl")} placeholder="https://…/apple-icon.png" />
            </Row>
            <Row label="Share image" hint="1200×630, shown when your link is shared on WhatsApp or LinkedIn.">
              <AssetInput id="p-og" value={form.ogImageUrl ?? ""} onChange={set("ogImageUrl")} placeholder="https://…/share.png" />
            </Row>
          </div>
        </AdminPanel>

        <AdminPanel title="Sign-in page">
          <div className="space-y-4">
            <Row label="Headline" hint="The large line on the green panel. The Website CMS can override it.">
              <input
                className={adminInputClass}
                value={form.loginHeadline ?? ""}
                maxLength={90}
                onChange={(e) => set("loginHeadline")(e.target.value)}
              />
            </Row>
            <Row label="Subtext">
              <textarea
                className={cn(adminInputClass, "h-20 py-2")}
                value={form.loginSubtext ?? ""}
                maxLength={260}
                onChange={(e) => set("loginSubtext")(e.target.value)}
              />
            </Row>
          </div>
        </AdminPanel>

        <AdminPanel title="Contact">
          <div className="space-y-4">
            <Row label="Support email">
              <input className={adminInputClass} value={form.supportEmail ?? ""} onChange={(e) => set("supportEmail")(e.target.value)} />
            </Row>
            <Row label="Support phone">
              <input className={adminInputClass} value={form.supportPhone ?? ""} onChange={(e) => set("supportPhone")(e.target.value)} />
            </Row>
            <Row label="Website">
              <input className={adminInputClass} value={form.website ?? ""} onChange={(e) => set("website")(e.target.value)} />
            </Row>
          </div>
        </AdminPanel>
      </div>

      <p className="mt-4 text-xs text-slate-500">
        A change reaches the app within five minutes, or straight away on a hard refresh.
        Anything left blank falls back to the built-in defaults.
      </p>
    </div>
  );
}
