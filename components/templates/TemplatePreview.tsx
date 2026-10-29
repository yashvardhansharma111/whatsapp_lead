"use client";

import {
  Copy, ExternalLink, FileText, Film, ImageIcon, MapPin, Phone, Reply, Timer,
} from "lucide-react";
import {
  namedParams, positionalCount,
  type TemplateButtonDraft, type TemplateCardDraft, type TemplateDraft,
} from "@/lib/templates/spec";
import { cn } from "@/lib/utils";

/** Placeholders swapped for their examples, so the preview reads like a real message. */
function fill(text: string, examples: string[], format: TemplateDraft["parameterFormat"]): string {
  if (!text) return "";
  if (format === "NAMED") {
    const names = namedParams(text);
    return text.replace(/\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/g, (match, name: string) => {
      const value = examples[names.indexOf(name)];
      return value?.trim() ? value : match;
    });
  }
  return text.replace(/\{\{\s*(\d+)\s*\}\}/g, (match, n: string) => {
    const value = examples[Number(n) - 1];
    return value?.trim() ? value : match;
  });
}

/** WhatsApp's own markdown: *bold*, _italic_, ~strike~, ```mono```. */
function formatted(text: string): string {
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/```([^`]+)```/g, '<code class="rounded bg-black/5 px-1 font-mono text-[0.9em]">$1</code>')
    .replace(/(^|\s)\*([^*\n]+)\*/g, "$1<strong>$2</strong>")
    .replace(/(^|\s)_([^_\n]+)_/g, "$1<em>$2</em>")
    .replace(/(^|\s)~([^~\n]+)~/g, "$1<s>$2</s>")
    .replace(/\n/g, "<br />");
}

const BUTTON_ICON: Partial<Record<TemplateButtonDraft["type"], typeof Reply>> = {
  QUICK_REPLY:  Reply,
  URL:          ExternalLink,
  PHONE_NUMBER: Phone,
  VOICE_CALL:   Phone,
  COPY_CODE:    Copy,
};

function PreviewButtons({ buttons }: { buttons: TemplateButtonDraft[] }) {
  if (!buttons.length) return null;
  // WhatsApp shows three and collapses the rest behind one more row.
  const shown = buttons.slice(0, 3);
  const hidden = buttons.length - shown.length;

  return (
    <div className="divide-y divide-black/5 border-t border-black/5">
      {shown.map((b, i) => {
        const Icon = BUTTON_ICON[b.type];
        const label = b.type === "OTP"
          ? (b.autofillText?.trim() || "Copy code")
          : (b.text?.trim() || (b.type === "COPY_CODE" ? "Copy code" : "Button"));
        return (
          <p key={i} className="flex items-center justify-center gap-1.5 py-2 text-[13px] font-medium text-[#00a5f4]">
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {label}
          </p>
        );
      })}
      {hidden > 0 && (
        <p className="py-2 text-center text-[13px] font-medium text-[#00a5f4]">See all options</p>
      )}
    </div>
  );
}

function MediaBlock({ format, url, className }: { format: string; url?: string | null; className?: string }) {
  const Icon = format === "VIDEO" ? Film : format === "DOCUMENT" ? FileText : ImageIcon;
  if (url?.trim() && format === "IMAGE") {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- a customer-supplied CDN URL, not a bundled asset
      <img src={url} alt="" className={cn("h-32 w-full rounded-lg object-cover", className)} />
    );
  }
  return (
    <div className={cn("flex h-32 w-full items-center justify-center rounded-lg bg-black/5", className)}>
      <Icon className="h-7 w-7 text-black/20" />
    </div>
  );
}

function CardPreview({ card, draft }: { card: TemplateCardDraft; draft: TemplateDraft }) {
  return (
    <div className="w-44 shrink-0 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5">
      <MediaBlock format={card.headerFormat} url={card.headerUrl} className="rounded-none" />
      {card.body?.trim() && (
        <p
          className="px-2.5 py-2 text-[12px] leading-snug text-[#111b21]"
          dangerouslySetInnerHTML={{
            __html: formatted(fill(card.body, card.bodyVariables ?? [], draft.parameterFormat)),
          }}
        />
      )}
      <PreviewButtons buttons={card.buttons ?? []} />
    </div>
  );
}

/**
 * The template as the customer will see it. Examples stand in for the variables, which is
 * also what Meta's reviewer sees, so the preview doubles as a check on the examples.
 */
export function TemplatePreview({ draft }: { draft: TemplateDraft }) {
  const isAuth = draft.category === "AUTHENTICATION";
  const isCarousel = draft.templateType === "CAROUSEL";

  const bodyText = isAuth
    ? "*123456* is your verification code."
    : fill(draft.body, draft.variables, draft.parameterFormat);

  const headerText = draft.headerType === "TEXT"
    ? fill(draft.headerContent, draft.headerVariables, draft.parameterFormat)
    : "";

  const varsUnfilled = draft.parameterFormat === "NAMED"
    ? namedParams(draft.body).length > draft.variables.filter((v) => v?.trim()).length
    : positionalCount(draft.body) > draft.variables.filter((v) => v?.trim()).length;

  return (
    <div className="rounded-xl bg-[#e4ddd6] p-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-black/40">Preview</p>

      <div className="space-y-1.5">
        <div className="max-w-[17rem] overflow-hidden rounded-xl bg-white shadow-sm">
          {!isCarousel && draft.headerType !== "NONE" && draft.headerType !== "TEXT" && (
            <div className="p-1.5 pb-0">
              {draft.headerType === "LOCATION" ? (
                <div className="flex h-24 w-full items-center justify-center gap-1.5 rounded-lg bg-black/5 text-xs text-black/40">
                  <MapPin className="h-4 w-4" /> Location
                </div>
              ) : (
                <MediaBlock
                  format={draft.headerType}
                  url={draft.headerContent.startsWith("http") ? draft.headerContent : null}
                />
              )}
            </div>
          )}

          <div className="px-2.5 py-2">
            {headerText.trim() && (
              <p className="mb-1 text-[13px] font-semibold text-[#111b21]">{headerText}</p>
            )}

            {draft.ltoText.trim() && (
              <p className="mb-1.5 inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">
                <Timer className="h-3 w-3" />
                {draft.ltoText}
                {draft.ltoHasExpiration && <span className="text-emerald-600/70">· ends soon</span>}
              </p>
            )}

            {bodyText.trim() ? (
              <p
                className="whitespace-pre-wrap text-[13.5px] leading-snug text-[#111b21]"
                dangerouslySetInnerHTML={{ __html: formatted(bodyText) }}
              />
            ) : (
              <p className="text-[13.5px] italic text-black/30">Your message will appear here</p>
            )}

            {isAuth && draft.addSecurityRecommendation && (
              <p className="mt-1 text-[12px] text-black/50">For your security, do not share this code.</p>
            )}

            {!isCarousel && draft.footer.trim() && (
              <p className="mt-1.5 text-[11.5px] text-black/45">{draft.footer}</p>
            )}

            {isAuth && draft.codeExpirationMinutes != null && (
              <p className="mt-1.5 text-[11.5px] text-black/45">
                This code expires in {draft.codeExpirationMinutes} minutes.
              </p>
            )}

            <p className="mt-0.5 text-right text-[10px] text-black/35">
              {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>

          <PreviewButtons buttons={draft.buttons} />
        </div>

        {isCarousel && draft.cards.length > 0 && (
          <div className="scrollbar-slim flex gap-2 overflow-x-auto pb-1">
            {draft.cards.map((card, i) => (
              <CardPreview key={i} card={card} draft={draft} />
            ))}
          </div>
        )}
      </div>

      {varsUnfilled && !isAuth && (
        <p className="mt-2 text-[11px] text-black/45">
          Variables without an example are left as placeholders here, and Meta sees them the same way.
        </p>
      )}
    </div>
  );
}
