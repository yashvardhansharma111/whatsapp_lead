"use client";

/**
 * Every interactive message WhatsApp lets a business send from a chat.
 *
 * The composer offered two of them — reply buttons and a list — with no header, no
 * footer, and a list pinned to a single section. Meta's Cloud API has six that make
 * sense from an inbox, and the ones missing were the cheap useful ones: a link button,
 * "share your location", and the address form that only India and Singapore get.
 *
 * Limits here are Meta's, enforced in the inputs rather than discovered when the send is
 * refused. They differ per type, which is why they are written out per type rather than
 * shared: a list body may be 4096 characters and a button body 1024, a list header may
 * only ever be text, and location and address take no header or footer at all.
 *
 * Not here, deliberately:
 *  · Products and the product list — the Catalogue screen already sends those, against
 *    the number's connected catalogue, and a second way to do it would drift from it.
 *  · Flows — a Flow has to be built and published in Meta's own Flow Builder and
 *    referenced by id. Nothing in this product registers one, so a field for it would
 *    just be somewhere to paste a string that fails.
 */

import { useState } from "react";
import { Clock, LayoutList, Link2, MapPin, Plus, Send, ShoppingBag, SquareStack, Trash2, X } from "lucide-react";
import { Button, inputClass } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { InteractivePayload } from "@/lib/validators/message";

type Kind = "button" | "list" | "cta_url" | "location_request_message" | "address_message" | "catalog_message";

const KINDS: { id: Kind; label: string; icon: typeof Link2; hint: string }[] = [
  { id: "button",  label: "Buttons",  icon: SquareStack, hint: "Up to three tappable replies." },
  { id: "list",    label: "List",     icon: LayoutList,  hint: "A menu of up to ten options, grouped into sections." },
  { id: "cta_url", label: "Link",     icon: Link2,       hint: "A button that opens a web page. No reply comes back." },
  { id: "location_request_message", label: "Ask location", icon: MapPin, hint: "A button that asks the customer to share where they are." },
  { id: "address_message", label: "Address", icon: MapPin, hint: "An address form. India and Singapore only — other countries are refused by Meta." },
  { id: "catalog_message", label: "Catalogue", icon: ShoppingBag, hint: "Opens your whole catalogue. The number needs one connected in Settings." },
];

/** Header media is given as a link; Meta fetches it. Text headers are 60 characters. */
type HeaderKind = "none" | "text" | "image" | "video" | "document";

interface HeaderState { kind: HeaderKind; text: string; link: string }

const EMPTY_HEADER: HeaderState = { kind: "none", text: "", link: "" };

/** Which header kinds each type accepts. A list takes text only; location and address none. */
function headerKindsFor(kind: Kind): HeaderKind[] {
  switch (kind) {
    case "button":
    case "cta_url":
      return ["none", "text", "image", "video", "document"];
    case "list":
      return ["none", "text"];
    default:
      return [];
  }
}

function supportsFooter(kind: Kind): boolean {
  return kind !== "location_request_message" && kind !== "address_message";
}

/** Meta caps a list's body at 4096 and everything else's at 1024. */
function bodyLimit(kind: Kind): number {
  return kind === "list" ? 4096 : 1024;
}

interface Section { title: string; rows: { title: string; description: string }[] }

const MAX_LIST_ROWS = 10;

export function InteractiveComposer({
  onSend,
  onClose,
  pending,
}: {
  onSend: (interactive: InteractivePayload, bodyText: string) => Promise<void>;
  onClose: () => void;
  pending: boolean;
}) {
  const [kind, setKind] = useState<Kind>("button");
  const [body, setBody] = useState("");
  const [footer, setFooter] = useState("");
  const [header, setHeader] = useState<HeaderState>(EMPTY_HEADER);
  const [error, setError] = useState<string | null>(null);

  const [buttons, setButtons] = useState<string[]>(["", ""]);
  const [listBtn, setListBtn] = useState("Select an option");
  const [sections, setSections] = useState<Section[]>([{ title: "", rows: [{ title: "", description: "" }] }]);
  const [ctaText, setCtaText] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [country, setCountry] = useState<"IN" | "SG">("IN");
  const [thumbRetailerId, setThumbRetailerId] = useState("");

  const allowedHeaders = headerKindsFor(kind);
  const rowCount = sections.reduce((n, s) => n + s.rows.length, 0);

  /** The header as Meta wants it, or undefined when there isn't one to send. */
  function buildHeader(): Record<string, unknown> | undefined {
    if (!allowedHeaders.includes(header.kind) || header.kind === "none") return undefined;
    if (header.kind === "text") {
      const text = header.text.trim();
      return text ? { type: "text", text } : undefined;
    }
    const link = header.link.trim();
    return link ? { type: header.kind, [header.kind]: { link } } : undefined;
  }

  function build(): InteractivePayload | string {
    const text = body.trim();
    if (!text) return "Body text is required.";

    const head = buildHeader();
    const foot = supportsFooter(kind) && footer.trim() ? { text: footer.trim() } : undefined;
    const common = {
      body: { text },
      ...(head ? { header: head } : {}),
      ...(foot ? { footer: foot } : {}),
    };

    switch (kind) {
      case "button": {
        const titles = buttons.map((b) => b.trim()).filter(Boolean);
        if (!titles.length) return "Add at least one button.";
        if (new Set(titles.map((t) => t.toLowerCase())).size !== titles.length) {
          // Meta rejects the whole message for this, and the error it returns does not
          // say which pair collided.
          return "Two buttons have the same label. WhatsApp needs them to differ.";
        }
        return {
          type: "button",
          ...common,
          action: { buttons: titles.map((title, i) => ({ type: "reply" as const, reply: { id: `btn_${i}`, title } })) },
        } as InteractivePayload;
      }

      case "list": {
        const filled = sections
          .map((s) => ({ title: s.title.trim(), rows: s.rows.filter((r) => r.title.trim()) }))
          .filter((s) => s.rows.length);
        if (!filled.length) return "Add at least one list option.";
        if (filled.reduce((n, s) => n + s.rows.length, 0) > MAX_LIST_ROWS) {
          return `A list can hold ${MAX_LIST_ROWS} options in total, across every section.`;
        }
        if (filled.length > 1 && filled.some((s) => !s.title)) {
          return "Every section needs a title once there is more than one.";
        }
        let n = 0;
        return {
          type: "list",
          ...common,
          action: {
            button: listBtn.trim() || "Select an option",
            sections: filled.map((s) => ({
              ...(s.title ? { title: s.title } : {}),
              rows: s.rows.map((r) => ({
                id: `row_${n++}`,
                title: r.title.trim(),
                ...(r.description.trim() ? { description: r.description.trim() } : {}),
              })),
            })),
          },
        } as InteractivePayload;
      }

      case "cta_url": {
        const url = ctaUrl.trim();
        const display = ctaText.trim();
        if (!display) return "The button needs a label.";
        if (!/^https?:\/\/\S+$/i.test(url)) return "Enter a full web address, starting http:// or https://.";
        return {
          type: "cta_url",
          ...common,
          action: { name: "cta_url", parameters: { display_text: display, url } },
        } as InteractivePayload;
      }

      case "location_request_message":
        return {
          type: "location_request_message",
          body: { text },
          action: { name: "send_location" },
        } as InteractivePayload;

      case "address_message":
        return {
          type: "address_message",
          body: { text },
          action: { name: "address_message", parameters: { country } },
        } as InteractivePayload;

      case "catalog_message":
        return {
          type: "catalog_message",
          ...common,
          action: {
            name: "catalog_message",
            ...(thumbRetailerId.trim()
              ? { parameters: { thumbnail_product_retailer_id: thumbRetailerId.trim() } }
              : {}),
          },
        } as InteractivePayload;
    }
  }

  async function submit() {
    setError(null);
    const built = build();
    if (typeof built === "string") { setError(built); return; }
    try {
      await onSend(built, body.trim());
      setBody("");
      setFooter("");
      setHeader(EMPTY_HEADER);
      setButtons(["", ""]);
      setSections([{ title: "", rows: [{ title: "", description: "" }] }]);
      setCtaText("");
      setCtaUrl("");
      setThumbRetailerId("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send interactive message");
    }
  }

  const active = KINDS.find((k) => k.id === kind)!;
  const fieldClass = cn(inputClass, "py-1.5 text-base sm:text-sm");

  return (
    // Capped on phones so a long form can't push the input off a short viewport.
    <div className="scrollbar-slim mb-3 max-h-[45dvh] space-y-3 overflow-y-auto rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 sm:max-h-[60vh]">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-emerald-800">Interactive message</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close interactive message"
          className="-my-1 rounded p-2 text-slate-400 hover:text-slate-600 sm:my-0 sm:p-0.5"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {KINDS.map((k) => {
          const Icon = k.icon;
          return (
            <button
              key={k.id}
              type="button"
              onClick={() => { setKind(k.id); setError(null); }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition",
                kind === k.id
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50",
              )}
            >
              <Icon className="h-3 w-3" />
              {k.label}
            </button>
          );
        })}
      </div>

      <p className="text-[11px] leading-snug text-slate-500">{active.hint}</p>

      {allowedHeaders.length > 1 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-slate-500">Header (optional)</p>
          <div className="flex flex-wrap gap-1.5">
            {allowedHeaders.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHeader((p) => ({ ...p, kind: h }))}
                className={cn(
                  "rounded px-2 py-0.5 text-[11px] font-medium capitalize transition",
                  header.kind === h
                    ? "bg-slate-800 text-white"
                    : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50",
                )}
              >
                {h}
              </button>
            ))}
          </div>
          {header.kind === "text" && (
            <input
              value={header.text}
              maxLength={60}
              onChange={(e) => setHeader((p) => ({ ...p, text: e.target.value }))}
              placeholder="Header text (max 60)"
              className={fieldClass}
            />
          )}
          {["image", "video", "document"].includes(header.kind) && (
            <input
              value={header.link}
              onChange={(e) => setHeader((p) => ({ ...p, link: e.target.value }))}
              placeholder={`https://… link to the ${header.kind}`}
              className={fieldClass}
            />
          )}
        </div>
      )}

      <textarea
        rows={2}
        value={body}
        maxLength={bodyLimit(kind)}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Body text sent to the customer…"
        className={cn(inputClass, "resize-none text-base sm:text-sm")}
      />

      {kind === "button" && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-slate-500">Buttons (max 3, max 20 chars each)</p>
          {buttons.map((btn, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input
                value={btn}
                maxLength={20}
                onChange={(e) => setButtons((prev) => prev.map((b, j) => (j === i ? e.target.value : b)))}
                placeholder={`Button ${i + 1}`}
                className={cn(fieldClass, "flex-1")}
              />
              {buttons.length > 1 && (
                <button
                  type="button"
                  aria-label={`Remove button ${i + 1}`}
                  onClick={() => setButtons((prev) => prev.filter((_, j) => j !== i))}
                  className="rounded p-1 text-slate-400 hover:text-rose-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
          {buttons.length < 3 && (
            <button
              type="button"
              onClick={() => setButtons((prev) => [...prev, ""])}
              className="flex items-center gap-1 text-xs text-emerald-700 hover:underline"
            >
              <Plus className="h-3 w-3" /> Add button
            </button>
          )}
        </div>
      )}

      {kind === "list" && (
        <div className="space-y-2">
          <p className="text-[11px] font-medium text-slate-500">Menu button label</p>
          <input
            value={listBtn}
            maxLength={20}
            onChange={(e) => setListBtn(e.target.value)}
            placeholder="Select an option"
            className={fieldClass}
          />

          {sections.map((section, si) => (
            <div key={si} className="space-y-1.5 rounded-lg border border-slate-200 bg-white/70 p-2">
              <div className="flex items-center gap-1.5">
                <input
                  value={section.title}
                  maxLength={24}
                  onChange={(e) =>
                    setSections((prev) => prev.map((s, j) => (j === si ? { ...s, title: e.target.value } : s)))
                  }
                  placeholder={sections.length > 1 ? `Section ${si + 1} title` : "Section title (optional)"}
                  className={cn(fieldClass, "flex-1 font-medium")}
                />
                {sections.length > 1 && (
                  <button
                    type="button"
                    aria-label={`Remove section ${si + 1}`}
                    onClick={() => setSections((prev) => prev.filter((_, j) => j !== si))}
                    className="rounded p-1 text-slate-400 hover:text-rose-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {section.rows.map((row, ri) => (
                <div key={ri} className="flex items-start gap-1.5">
                  <div className="flex-1 space-y-1">
                    <input
                      value={row.title}
                      maxLength={24}
                      onChange={(e) =>
                        setSections((prev) =>
                          prev.map((s, j) =>
                            j === si
                              ? { ...s, rows: s.rows.map((r, k) => (k === ri ? { ...r, title: e.target.value } : r)) }
                              : s,
                          ),
                        )
                      }
                      placeholder={`Option ${ri + 1} title`}
                      className={fieldClass}
                    />
                    <input
                      value={row.description}
                      maxLength={72}
                      onChange={(e) =>
                        setSections((prev) =>
                          prev.map((s, j) =>
                            j === si
                              ? { ...s, rows: s.rows.map((r, k) => (k === ri ? { ...r, description: e.target.value } : r)) }
                              : s,
                          ),
                        )
                      }
                      placeholder="Description (optional)"
                      className={fieldClass}
                    />
                  </div>
                  {section.rows.length > 1 && (
                    <button
                      type="button"
                      aria-label={`Remove option ${ri + 1}`}
                      onClick={() =>
                        setSections((prev) =>
                          prev.map((s, j) => (j === si ? { ...s, rows: s.rows.filter((_, k) => k !== ri) } : s)),
                        )
                      }
                      className="mt-1 rounded p-1 text-slate-400 hover:text-rose-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}

              {rowCount < MAX_LIST_ROWS && (
                <button
                  type="button"
                  onClick={() =>
                    setSections((prev) =>
                      prev.map((s, j) => (j === si ? { ...s, rows: [...s.rows, { title: "", description: "" }] } : s)),
                    )
                  }
                  className="flex items-center gap-1 text-xs text-emerald-700 hover:underline"
                >
                  <Plus className="h-3 w-3" /> Add option
                </button>
              )}
            </div>
          ))}

          <div className="flex items-center justify-between">
            {sections.length < 10 && rowCount < MAX_LIST_ROWS ? (
              <button
                type="button"
                onClick={() => setSections((prev) => [...prev, { title: "", rows: [{ title: "", description: "" }] }])}
                className="flex items-center gap-1 text-xs text-emerald-700 hover:underline"
              >
                <Plus className="h-3 w-3" /> Add section
              </button>
            ) : <span />}
            <span className={cn("text-[11px]", rowCount >= MAX_LIST_ROWS ? "text-amber-700" : "text-slate-400")}>
              {rowCount} of {MAX_LIST_ROWS} options
            </span>
          </div>
        </div>
      )}

      {kind === "cta_url" && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-slate-500">Button label (max 20)</p>
          <input
            value={ctaText}
            maxLength={20}
            onChange={(e) => setCtaText(e.target.value)}
            placeholder="Visit our site"
            className={fieldClass}
          />
          <p className="text-[11px] font-medium text-slate-500">Web address</p>
          <input
            value={ctaUrl}
            onChange={(e) => setCtaUrl(e.target.value)}
            placeholder="https://example.com/offer"
            className={fieldClass}
          />
        </div>
      )}

      {kind === "address_message" && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-slate-500">Country</p>
          <div className="flex gap-1.5">
            {(["IN", "SG"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCountry(c)}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium transition",
                  country === c ? "bg-slate-800 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200",
                )}
              >
                {c === "IN" ? "India" : "Singapore"}
              </button>
            ))}
          </div>
          <p className="text-[11px] leading-snug text-slate-500">
            WhatsApp only shows the address form to customers in these two countries. Anywhere
            else, Meta refuses the message.
          </p>
        </div>
      )}

      {kind === "catalog_message" && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-slate-500">Cover product ID (optional)</p>
          <input
            value={thumbRetailerId}
            onChange={(e) => setThumbRetailerId(e.target.value)}
            placeholder="Retailer ID of the product to show on the card"
            className={fieldClass}
          />
          <p className="text-[11px] leading-snug text-slate-500">
            Sends a card that opens your whole catalogue. To send a few chosen products
            instead, use the Catalogue screen.
          </p>
        </div>
      )}

      {supportsFooter(kind) && (
        <input
          value={footer}
          maxLength={60}
          onChange={(e) => setFooter(e.target.value)}
          placeholder="Footer (optional, max 60)"
          className={fieldClass}
        />
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700">{error}</p>
      )}

      <Button size="sm" onClick={submit} disabled={pending || !body.trim()}>
        {pending ? <Clock className="h-3.5 w-3.5 animate-pulse" /> : <Send className="h-3.5 w-3.5" />}
        Send interactive
      </Button>
    </div>
  );
}
