"use client";

// A URL box with an upload button beside it, for a logo, a favicon or any brand image.
//
// These fields used to take a URL and nothing else, which meant finding somewhere to host
// the file before you could set one — for a favicon, that is most of the job. The box
// still accepts a URL, because an image already hosted somewhere should not have to be
// uploaded again.

import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { inputClass } from "@/components/ui";
import { cn } from "@/lib/utils";

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/x-icon,.ico";

export function AssetInput({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shown = value.trim();
  const previewable = /^(https:\/\/|\/)/i.test(shown);

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
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          inputMode="url"
          spellCheck={false}
          className={cn(inputClass, "min-w-0 flex-1 font-mono text-[13px]")}
        />
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          title="Upload an image"
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200 transition hover:bg-slate-50 disabled:opacity-60 sm:h-9"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {busy ? "Uploading…" : "Upload"}
        </button>
        {previewable && (
          // eslint-disable-next-line @next/next/no-img-element -- an arbitrary URL the admin set
          <img
            src={shown}
            alt=""
            className="h-10 w-10 shrink-0 rounded-lg bg-slate-50 object-contain ring-1 ring-slate-200 sm:h-9 sm:w-9"
          />
        )}
      </div>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
