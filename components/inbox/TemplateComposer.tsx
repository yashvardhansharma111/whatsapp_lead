"use client";

// The composer for a chat WhatsApp will not carry a typed message to.
//
// Free-form messages reach someone only for 24 hours after they last wrote. Outside that
// — and before they have ever written at all — an approved template is the only thing
// that arrives. Nothing in the inbox knew this: an agent typed a reply, watched it appear
// in the thread, and Meta refused it seconds later with "more than 24 hours since they
// last replied", wording the agent never saw on a message that still looked sent.
//
// So when the window is shut this replaces the text box rather than sitting beside it.
// Offering both would be offering one that cannot work.
//
// The filling-in happens in a dialog, not in the footer. Inline, picking a template with
// an image header grew the footer past the height of the chat: the conversation was
// pushed off screen, the Send button sat below the fold, and there was nowhere to show
// what was about to go out. The dialog has room for the form and the preview side by
// side, and the chat stays where it was.

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, FileText, Film, ImageIcon, Loader2, Phone, Reply, Send } from "lucide-react";
import { Button, Modal, formatWaText, inputClass } from "@/components/ui";
import { useTemplates } from "@/hooks/useTemplates";
import { numberLabel, useWhatsAppNumbers } from "@/hooks/useWhatsAppNumbers";
import {
  detectBodyVarSlots,
  dynamicUrlButtons,
  renderTemplateBody,
  templateButtons,
  type TemplateButton,
  type TemplateShape,
} from "@/lib/campaigns/templateVars";
import { HeaderMediaInput, type HeaderMediaValue, type MediaHeaderType } from "@/components/campaigns/HeaderMediaInput";
import { cn } from "@/lib/utils";

const MEDIA_HEADERS = ["IMAGE", "VIDEO", "DOCUMENT"] as const;

interface TemplateOption {
  id: string;
  name: string;
  status?: string | null;
  category?: string | null;
  language?: string | null;
  body?: string | null;
  footer?: string | null;
  headerType?: string | null;
  headerContent?: string | null;
  buttons?: unknown;
}

/** The shape the variable helpers expect, with the nullable columns filled in. */
const asShape = (t: TemplateOption): TemplateShape => ({
  body: t.body ?? "",
  headerType: t.headerType ?? null,
  headerContent: t.headerContent ?? null,
  buttons: t.buttons,
});

/** `{{1}}` slots in a heading, filled from the values typed for it. */
function fillSlots(text: string, values: string[]): string {
  return text.replace(/\{\{\s*(\d+)\s*\}\}/g, (whole, n: string) => values[Number(n) - 1]?.trim() || whole);
}

export function TemplateComposer({
  conversationId,
  whatsappIntegrationId,
  reason,
  onSent,
  footer = true,
  open: openProp,
  onOpenChange,
}: {
  conversationId: string;
  whatsappIntegrationId?: string | null;
  /** Why the text box is not available, in words the agent can repeat to a colleague. */
  reason?: string;
  onSent: () => void;
  /**
   * The amber bar that replaces the text box when the window is shut. Omitted when the
   * window is open and a template is a choice rather than the only option — the dialog
   * is then opened from the composer menu instead.
   */
  footer?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { data, isLoading } = useTemplates(whatsappIntegrationId ?? undefined);
  // Which number this thread is on, which is not always the one picked in the navbar:
  // a thread belongs to the number the customer wrote to. Templates belong to a WhatsApp
  // account, so a chat on one number cannot send another's — and saying only "on this
  // number" left no way to work out which number was meant, or why the Templates screen
  // was visibly full of approved ones.
  const { numbers } = useWhatsAppNumbers();
  const threadNumber = numbers.find((n) => n.id === whatsappIntegrationId);
  const [openSelf, setOpenSelf] = useState(false);
  const open = openProp ?? openSelf;
  const setOpen = onOpenChange ?? setOpenSelf;
  const [templateId, setTemplateId] = useState("");
  const [vars, setVars] = useState<string[]>([]);
  const [urls, setUrls] = useState<string[]>([]);
  const [headerVars, setHeaderVars] = useState<string[]>([]);
  const [media, setMedia] = useState<HeaderMediaValue>({ mediaId: "", mediaUrl: "" });
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // An object URL holds the file in memory until it is released.
  useEffect(() => () => { if (localPreview) URL.revokeObjectURL(localPreview); }, [localPreview]);

  // Every approved template, not only the plain ones. Hiding anything with a header left
  // three of this number's eighteen on offer — and the fourteen with an image were the
  // ones people actually send. The header is asked for here instead, the same way a
  // campaign asks.
  //
  // A coupon-code button is still left out: its value has nowhere to be entered yet, and
  // offering a template that would be refused helps nobody.
  const options = useMemo(
    () =>
      ((data ?? []) as TemplateOption[]).filter(
        (t) =>
          t.status === "APPROVED" &&
          !templateButtons(asShape(t)).some((b: TemplateButton) => b.type === "COPY_CODE"),
      ),
    [data],
  );

  const selected = options.find((t) => t.id === templateId) ?? null;
  const slots = selected ? detectBodyVarSlots(selected.body ?? "") : 0;
  const urlSlots = selected ? dynamicUrlButtons(asShape(selected)) : [];
  const header = selected?.headerType?.toUpperCase() ?? null;
  const mediaHeader = header && (MEDIA_HEADERS as readonly string[]).includes(header)
    ? (header as MediaHeaderType)
    : null;
  const headerSlots = header === "TEXT" ? detectBodyVarSlots(selected?.headerContent ?? "") : 0;
  const buttons = selected ? templateButtons(asShape(selected)) : [];

  const missing =
    !selected ||
    Array.from({ length: slots }).some((_, i) => !(vars[i] ?? "").trim()) ||
    Array.from({ length: headerSlots }).some((_, i) => !(headerVars[i] ?? "").trim()) ||
    urlSlots.some((_, i) => !(urls[i] ?? "").trim()) ||
    Boolean(mediaHeader && !media.mediaId && !media.mediaUrl.trim());

  function reset() {
    setTemplateId("");
    setVars([]);
    setUrls([]);
    setHeaderVars([]);
    setMedia({ mediaId: "", mediaUrl: "" });
    setLocalPreview(null);
    setError(null);
  }

  function pick(id: string) {
    setTemplateId(id);
    setVars([]);
    setUrls([]);
    setHeaderVars([]);
    setMedia({ mediaId: "", mediaUrl: "" });
    setLocalPreview(null);
    setError(null);
  }

  async function send() {
    if (!selected) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/conversations/${conversationId}/template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selected.id,
          bodyVarMapping: Array.from({ length: slots }, (_, i) => vars[i] ?? ""),
          urlButtonMapping: urlSlots.map((_, i) => urls[i] ?? ""),
          headerVarMapping: Array.from({ length: headerSlots }, (_, i) => headerVars[i] ?? ""),
          headerMediaId: media.mediaId || undefined,
          headerMediaUrl: media.mediaUrl.trim() || undefined,
          headerMediaStoredUrl: media.storedUrl || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Couldn't send this template");
      reset();
      setOpen(false);
      onSent();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  const previewImage = media.storedUrl || localPreview || media.mediaUrl.trim() || null;

  return (
    <>
      {/* The footer stays one line tall whatever the template needs. */}
      {footer && (
      <div className="shrink-0 border-t border-slate-200 bg-amber-50/60 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 lg:px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="min-w-[12rem] flex-1 text-xs leading-relaxed text-amber-900">{reason}</p>
          <Button
            size="sm"
            disabled={isLoading || options.length === 0}
            onClick={() => setOpen(true)}
          >
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Send a template
          </Button>
        </div>
        {!isLoading && options.length === 0 && (
          <p className="mt-1.5 text-xs text-slate-600">
            {threadNumber
              ? `No approved template on ${numberLabel(threadNumber)} — the number this chat is on. `
              : "No approved template is available on this number yet. "}
            Create one under Templates, or wait for them to message you.
          </p>
        )}
      </div>
      )}

      <Modal
        open={open}
        onClose={() => { if (!sending) { setOpen(false); reset(); } }}
        title="Send a template"
        description={
          footer
            ? "Outside the 24-hour window only an approved template reaches them. This is what they will see."
            : "An approved message, with an image header or buttons if the template has them. This is what they will see."
        }
        className="sm:max-w-3xl"
      >
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_17rem]">
          {/* ── What to send ─────────────────────────────────────────────── */}
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Template</span>
              <select
                id={`tpl-${conversationId}`}
                className={inputClass}
                value={templateId}
                onChange={(e) => pick(e.target.value)}
              >
                <option value="">Choose a template…</option>
                {options.map((t) => (
                  <option key={t.id} value={t.id}>
                    [{t.category}] {t.name} ({t.language})
                  </option>
                ))}
              </select>
            </label>

            {selected && (
              <>
                {mediaHeader && (
                  <HeaderMediaInput
                    key={selected.id}
                    templateId={selected.id}
                    headerType={mediaHeader}
                    value={media}
                    onChange={setMedia}
                    onError={setError}
                    onLocalPreview={setLocalPreview}
                  />
                )}

                {Array.from({ length: headerSlots }).map((_, i) => (
                  <input
                    key={`h${i}`}
                    id={`tpl-${conversationId}-h${i}`}
                    aria-label={`Heading value for {{${i + 1}}}`}
                    className={inputClass}
                    placeholder={`Heading value for {{${i + 1}}}`}
                    value={headerVars[i] ?? ""}
                    onChange={(e) => {
                      const next = [...headerVars];
                      next[i] = e.target.value;
                      setHeaderVars(next);
                    }}
                  />
                ))}

                {Array.from({ length: slots }).map((_, i) => (
                  <input
                    key={`v${i}`}
                    id={`tpl-${conversationId}-v${i}`}
                    aria-label={`Value for {{${i + 1}}}`}
                    className={inputClass}
                    placeholder={`Value for {{${i + 1}}}`}
                    value={vars[i] ?? ""}
                    onChange={(e) => {
                      const next = [...vars];
                      next[i] = e.target.value;
                      setVars(next);
                    }}
                  />
                ))}

                {urlSlots.map((b, i) => (
                  <input
                    key={`u${i}`}
                    id={`tpl-${conversationId}-u${i}`}
                    aria-label={`Link for the ${b.text} button`}
                    className={inputClass}
                    placeholder={`Link for the “${b.text}” button`}
                    value={urls[i] ?? ""}
                    onChange={(e) => {
                      const next = [...urls];
                      next[i] = e.target.value;
                      setUrls(next);
                    }}
                  />
                ))}
              </>
            )}

            {error && <p className="text-xs text-rose-600">{error}</p>}
          </div>

          {/* ── What they will see ───────────────────────────────────────── */}
          <div className="rounded-xl bg-[#e4ddd6] p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-black/40">
              Preview
            </p>
            {selected ? (
              <div className="overflow-hidden rounded-xl bg-white shadow-sm">
                {mediaHeader && (
                  <div className="p-1.5 pb-0">
                    {previewImage && mediaHeader === "IMAGE" ? (
                      // eslint-disable-next-line @next/next/no-img-element -- a blob or customer CDN URL, not a bundled asset
                      <img src={previewImage} alt="" className="h-32 w-full rounded-lg object-cover" />
                    ) : (
                      <div className="flex h-32 w-full items-center justify-center rounded-lg bg-black/5">
                        {mediaHeader === "VIDEO" ? (
                          <Film className="h-7 w-7 text-black/20" />
                        ) : mediaHeader === "DOCUMENT" ? (
                          <FileText className="h-7 w-7 text-black/20" />
                        ) : (
                          <ImageIcon className="h-7 w-7 text-black/20" />
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="px-2.5 py-2">
                  {header === "TEXT" && (selected.headerContent ?? "").trim() && (
                    <p className="mb-1 text-[13px] font-semibold text-[#111b21]">
                      {fillSlots(selected.headerContent ?? "", headerVars)}
                    </p>
                  )}
                  <p
                    className="whitespace-pre-wrap text-[13.5px] leading-snug text-[#111b21]"
                    dangerouslySetInnerHTML={{
                      __html: formatWaText(
                        renderTemplateBody(
                          selected.body ?? "",
                          Array.from({ length: slots }, (_, i) => vars[i] ?? ""),
                        ),
                      ),
                    }}
                  />
                  {selected.footer?.trim() && (
                    <p className="mt-1.5 text-[11.5px] text-black/45">{selected.footer}</p>
                  )}
                </div>

                {buttons.length > 0 && (
                  <div className="divide-y divide-black/5 border-t border-black/5">
                    {buttons.slice(0, 3).map((b, i) => (
                      <p
                        key={i}
                        className="flex items-center justify-center gap-1.5 py-2 text-[13px] font-medium text-[#00a5f4]"
                      >
                        {b.type === "URL" && <ExternalLink className="h-3.5 w-3.5" />}
                        {b.type === "PHONE_NUMBER" && <Phone className="h-3.5 w-3.5" />}
                        {b.type === "QUICK_REPLY" && <Reply className="h-3.5 w-3.5" />}
                        {b.text?.trim() || "Button"}
                      </p>
                    ))}
                    {buttons.length > 3 && (
                      <p className="py-2 text-center text-[13px] font-medium text-[#00a5f4]">
                        See all options
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="py-8 text-center text-[13px] text-black/40">
                Choose a template to see it here.
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
          <Button
            variant="secondary"
            disabled={sending}
            onClick={() => { setOpen(false); reset(); }}
          >
            Cancel
          </Button>
          <Button disabled={missing || sending} onClick={send} className={cn(sending && "opacity-70")}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sending ? "Sending…" : "Send template"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
