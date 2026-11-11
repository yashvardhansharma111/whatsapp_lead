"use client";

/**
 * One input per CMS field type.
 *
 * Every control is driven by the field spec in lib/cms/sections.ts, so a new
 * field needs no admin UI work unless it introduces a new *type*. Checks here
 * are for instant feedback only — the API route re-validates everything.
 */

import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { adminInputClass, AdminButton } from "@/components/admin/ui";
import { Toggle } from "@/components/ui/Toggle";
import { CmsIcon } from "@/components/marketing/home/cmsIcon";
import { CMS_ICON_NAMES } from "@/lib/cms/icons";
import { isSafeHref, isSafeImageUrl, type FieldSpec, type LinkEntry } from "@/lib/cms/fields";
import { cn } from "@/lib/utils";

const WIDE_TYPES = new Set(["textarea", "list", "links"]);

export function isWideField(field: FieldSpec) {
  return WIDE_TYPES.has(field.type);
}

export function FieldInput({
  field,
  value,
  onChange,
  idPrefix,
}: {
  field: FieldSpec;
  value: unknown;
  onChange: (value: unknown) => void;
  /** Keeps label/input ids unique when the same field appears in many items. */
  idPrefix: string;
}) {
  const id = `${idPrefix}-${field.key}`;

  if (field.type === "boolean") {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
        <label htmlFor={id} className="text-sm font-medium text-slate-700">
          {field.label}
        </label>
        <Toggle size="sm" checked={value === true} onChange={onChange} label={field.label} />
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-slate-700">
          {field.label}
          {field.required && <span className="ml-0.5 text-rose-500">*</span>}
        </label>
        {(field.type === "text" || field.type === "textarea") && field.max && (
          <CharCount length={String(value ?? "").length} max={field.max} />
        )}
      </div>

      <Control field={field} value={value} onChange={onChange} id={id} />

      {field.hint && <p className="mt-1 text-xs text-slate-500">{field.hint}</p>}
    </div>
  );
}

function CharCount({ length, max }: { length: number; max: number }) {
  return (
    <span className={cn("nums shrink-0 text-[11px]", length > max ? "font-semibold text-rose-600" : "text-slate-400")}>
      {length}/{max}
    </span>
  );
}

function Control({
  field,
  value,
  onChange,
  id,
}: {
  field: FieldSpec;
  value: unknown;
  onChange: (value: unknown) => void;
  id: string;
}) {
  switch (field.type) {
    case "textarea":
      return (
        <textarea
          id={id}
          rows={3}
          value={String(value ?? "")}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
          className={cn(adminInputClass, "resize-y leading-relaxed")}
        />
      );

    case "url": {
      const text = String(value ?? "");
      const invalid = text.trim() !== "" && !isSafeHref(text.trim());
      return (
        <>
          <input
            id={id}
            type="text"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            value={text}
            placeholder={field.placeholder ?? "/pricing, #faq or https://…"}
            onChange={(event) => onChange(event.target.value)}
            aria-invalid={invalid || undefined}
            className={cn(adminInputClass, "font-mono text-[13px]", invalid && "border-rose-300 focus:border-rose-500 focus:ring-rose-100")}
          />
          {invalid && (
            <p className="mt-1 text-xs text-rose-600">
              Use a path like /pricing, an anchor like #faq, or a full https:// link.
            </p>
          )}
        </>
      );
    }

    case "image":
      return <ImageField id={id} value={String(value ?? "")} onChange={onChange} />;

    case "number":
      return (
        <input
          id={id}
          type="number"
          min={0}
          max={field.max}
          step="any"
          value={typeof value === "number" && Number.isFinite(value) ? value : 0}
          onChange={(event) => {
            const next = event.target.valueAsNumber;
            onChange(Number.isFinite(next) ? next : 0);
          }}
          className={cn(adminInputClass, "nums")}
        />
      );

    case "icon":
      return (
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-100 bg-emerald-50 text-[#0B6E4F]">
            <CmsIcon name={String(value)} className="h-4 w-4" />
          </span>
          <select
            id={id}
            value={String(value ?? "")}
            onChange={(event) => onChange(event.target.value)}
            className={cn(adminInputClass, "min-w-0 flex-1 cursor-pointer")}
          >
            {CMS_ICON_NAMES.map((name) => (
              <option key={name} value={name}>
                {name.replace(/([a-z])([A-Z0-9])/g, "$1 $2")}
              </option>
            ))}
          </select>
        </div>
      );

    case "select":
      return (
        <select
          id={id}
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
          className={cn(adminInputClass, "cursor-pointer")}
        >
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );

    case "list": {
      const lines = Array.isArray(value) ? (value as string[]) : [];
      const count = lines.filter((line) => line.trim() !== "").length;
      return (
        <>
          <textarea
            id={id}
            rows={Math.min(10, Math.max(3, lines.length + 1))}
            value={lines.join("\n")}
            placeholder="One entry per line"
            onChange={(event) => onChange(event.target.value.split("\n"))}
            className={cn(adminInputClass, "resize-y leading-relaxed")}
          />
          {field.max && (
            <p className={cn("mt-1 text-[11px]", count > field.max ? "font-semibold text-rose-600" : "text-slate-400")}>
              {count} of {field.max} entries
            </p>
          )}
        </>
      );
    }

    case "links":
      return (
        <LinksInput
          id={id}
          links={Array.isArray(value) ? (value as LinkEntry[]) : []}
          max={field.max ?? 20}
          onChange={onChange}
        />
      );

    default:
      return (
        <input
          id={id}
          type="text"
          value={String(value ?? "")}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
          className={adminInputClass}
        />
      );
  }
}

/** A small ordered list of label + URL rows, each switchable on and off. */
function LinksInput({
  id,
  links,
  max,
  onChange,
}: {
  id: string;
  links: LinkEntry[];
  max: number;
  onChange: (value: LinkEntry[]) => void;
}) {
  const update = (index: number, patch: Partial<LinkEntry>) =>
    onChange(links.map((link, i) => (i === index ? { ...link, ...patch } : link)));

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= links.length) return;
    const next = [...links];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div id={id} className="space-y-2">
      {links.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-center text-xs text-slate-500">
          No links yet.
        </p>
      )}

      {links.map((link, index) => {
        const invalid = link.href.trim() !== "" && !isSafeHref(link.href.trim());
        return (
          <div
            key={index}
            className={cn(
              "grid gap-2 rounded-lg border border-slate-200 bg-slate-50/60 p-2 sm:grid-cols-[1fr_1.3fr_auto]",
              !link.isActive && "opacity-60",
            )}
          >
            <input
              type="text"
              aria-label={`Link ${index + 1} label`}
              value={link.label}
              placeholder="Label"
              onChange={(event) => update(index, { label: event.target.value })}
              className={adminInputClass}
            />
            <input
              type="text"
              aria-label={`Link ${index + 1} URL`}
              inputMode="url"
              spellCheck={false}
              value={link.href}
              placeholder="/about or https://…"
              onChange={(event) => update(index, { href: event.target.value })}
              aria-invalid={invalid || undefined}
              className={cn(adminInputClass, "font-mono text-[13px]", invalid && "border-rose-300")}
            />
            <div className="flex items-center justify-end gap-1">
              <Toggle
                size="sm"
                checked={link.isActive}
                onChange={(next) => update(index, { isActive: next })}
                label={`Show link ${index + 1}`}
              />
              <IconButton label="Move link up" onClick={() => move(index, -1)} disabled={index === 0}>
                <ArrowUp className="h-3.5 w-3.5" />
              </IconButton>
              <IconButton label="Move link down" onClick={() => move(index, 1)} disabled={index === links.length - 1}>
                <ArrowDown className="h-3.5 w-3.5" />
              </IconButton>
              <IconButton label="Remove link" onClick={() => onChange(links.filter((_, i) => i !== index))} danger>
                <Trash2 className="h-3.5 w-3.5" />
              </IconButton>
            </div>
          </div>
        );
      })}

      <AdminButton
        type="button"
        variant="secondary"
        size="sm"
        disabled={links.length >= max}
        onClick={() => onChange([...links, { label: "", href: "", isActive: true }])}
      >
        <Plus className="h-3.5 w-3.5" />
        Add link
      </AdminButton>
    </div>
  );
}

export function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B6E4F]",
        "disabled:pointer-events-none disabled:opacity-30",
        danger ? "hover:bg-rose-50 hover:text-rose-600" : "hover:bg-slate-100 hover:text-slate-900",
      )}
    >
      {children}
    </button>
  );
}

/**
 * An image field: paste a URL, or upload the file and have one made for you.
 *
 * It used to take a URL and nothing else, so putting a logo or a favicon on the site
 * meant finding somewhere to host the file first — which for a favicon is most of the
 * job. The box still accepts a URL, because an image already hosted somewhere should not
 * have to be uploaded again.
 */
function ImageField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const text = value.trim();
  const valid = text !== "" && isSafeImageUrl(text);
  const invalid = text !== "" && !valid;

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/cms/assets", { method: "POST", body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Couldn't upload that image");
      onChange(((json.data ?? json) as { url: string }).url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't upload that image");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <input
            id={id}
            type="text"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            value={value}
            placeholder="https://… or upload"
            onChange={(event) => onChange(event.target.value)}
            aria-invalid={invalid || undefined}
            className={cn(adminInputClass, "font-mono text-[13px]", invalid && "border-rose-300")}
          />
          {invalid && <p className="mt-1 text-xs text-rose-600">Must be an https:// URL or a path like /logo.png.</p>}
          {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/x-icon,.ico"
          className="hidden"
          onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          title="Upload an image"
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {busy ? "Uploading…" : "Upload"}
        </button>

        {valid && (
          // eslint-disable-next-line @next/next/no-img-element -- admin preview of an arbitrary URL
          <img
            src={text}
            alt=""
            className="h-9 w-9 shrink-0 rounded-lg border border-slate-200 bg-slate-50 object-contain"
          />
        )}
      </div>
    </div>
  );
}
