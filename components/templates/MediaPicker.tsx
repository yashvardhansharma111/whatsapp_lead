"use client";

import { useState } from "react";
import { AlertCircle, FileText, Film, ImageIcon, Info, Loader2, Upload } from "lucide-react";
import { uploadTemplateMedia } from "@/hooks/useTemplates";
import { FILE_ACCEPT } from "@/lib/templates/spec";
import { cn } from "@/lib/utils";
import { inputClass } from "@/components/ui";

const ICON = { IMAGE: ImageIcon, VIDEO: Film, DOCUMENT: FileText } as const;

const WHAT = {
  IMAGE:    "a JPEG, PNG or WebP image",
  VIDEO:    "an MP4 video",
  DOCUMENT: "a PDF or Word document",
} as const;

export interface MediaValue {
  /** Resumable-upload handle, or a sample URL typed by hand. */
  handle: string | null;
  /** Public URL the same file can be sent from. */
  url: string | null;
}

/**
 * One file, two destinations. Meta reviews a template against an upload handle, but a sent
 * message needs a URL, so a card that has only a handle can be approved and never
 * delivered. The URL field appears when the upload cannot supply one, which is when no
 * bucket is configured for the workspace.
 */
export function MediaPicker({
  format,
  value,
  onChange,
  /** A carousel card cannot be sent without a URL, a header can. */
  requireUrl = false,
  idPrefix,
}: {
  format: "IMAGE" | "VIDEO" | "DOCUMENT";
  value: MediaValue;
  onChange: (next: MediaValue) => void;
  requireUrl?: boolean;
  idPrefix: string;
}) {
  const [state, setState] = useState<"idle" | "uploading" | "done" | "error">(
    value.handle ? "done" : "idle",
  );
  const [fileName, setFileName] = useState(value.handle ? "Uploaded earlier" : "");
  const [error, setError] = useState<string | null>(null);
  const Icon = ICON[format];

  async function pick(file: File) {
    if (file.size > 4 * 1024 * 1024) {
      setError(`That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 4 MB.`);
      setState("error");
      return;
    }
    setState("uploading");
    setFileName(file.name);
    setError(null);
    try {
      const uploaded = await uploadTemplateMedia(file);
      onChange({ handle: uploaded.handle, url: uploaded.url ?? value.url });
      setState("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The upload failed.");
      setState("error");
    }
  }

  const needsUrl = requireUrl && state === "done" && !value.url?.trim();

  return (
    <div className="space-y-2">
      <label
        htmlFor={`${idPrefix}-file`}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-5 text-center transition",
          state === "done"  && "border-emerald-300 bg-emerald-50/70",
          state === "error" && "border-rose-300 bg-rose-50/70",
          (state === "idle" || state === "uploading") && "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100",
        )}
      >
        {state === "uploading" ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            <span className="text-xs text-slate-500">Uploading…</span>
          </>
        ) : state === "done" ? (
          <>
            <Icon className="h-5 w-5 text-emerald-600" />
            <span className="max-w-full truncate text-xs font-medium text-emerald-800">{fileName}</span>
            <span className="text-[11px] text-emerald-700">Ready for review. Tap to replace.</span>
          </>
        ) : state === "error" ? (
          <>
            <AlertCircle className="h-5 w-5 text-rose-500" />
            <span className="text-xs text-rose-700">{error}</span>
            <span className="text-[11px] text-rose-600">Tap to try again.</span>
          </>
        ) : (
          <>
            <Upload className="h-5 w-5 text-slate-400" />
            <span className="text-xs text-slate-600">Choose {WHAT[format]}</span>
            <span className="text-[11px] text-slate-400">Up to 4 MB</span>
          </>
        )}
        <input
          id={`${idPrefix}-file`}
          type="file"
          className="sr-only"
          accept={FILE_ACCEPT[format]}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void pick(file);
            e.target.value = "";
          }}
        />
      </label>

      {(requireUrl || value.url) && (
        <div>
          <label htmlFor={`${idPrefix}-url`} className="mb-1 block text-[11px] font-medium text-slate-600">
            Public media URL
          </label>
          <input
            id={`${idPrefix}-url`}
            value={value.url ?? ""}
            onChange={(e) => onChange({ ...value, url: e.target.value })}
            className={cn(inputClass, "text-xs", needsUrl && "border-amber-400 focus:ring-amber-400")}
            placeholder="https://cdn.example.com/product.jpg"
          />
          <p className="mt-1 flex items-start gap-1 text-[11px] text-slate-400">
            <Info className="mt-px h-3 w-3 shrink-0" />
            {needsUrl
              ? "Media storage isn't set up for this workspace, so paste a public link to the same file. Messages are sent from this URL."
              : "Messages are sent from this URL. The upload above is only what Meta reviews."}
          </p>
        </div>
      )}
    </div>
  );
}
