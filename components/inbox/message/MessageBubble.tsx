"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle, BookOpen, Check, CheckCheck, Clock, ExternalLink, FileText,
  Image as ImageIcon, Info, LayoutList, MapPin, Phone, PhoneCall, PhoneIncoming,
  PhoneMissed, PhoneOff, PlayCircle, Reply, ShoppingCart, Sparkles, StickyNote,
  UserRound, X,
} from "lucide-react";
import { Badge, WaText } from "@/components/ui";
import { cn, formatTime } from "@/lib/utils";
import { formatBytes } from "@/lib/attachments";
import { displayPhone } from "@/lib/phone";
import type { InboxMessage } from "../ConversationList";

type MessageStatus = "READ" | "DELIVERED" | "SENT" | "FAILED" | "PENDING";
// ─── Bubbles ──────────────────────────────────────────────────────────────────

export function MessageBubble({
  message,
  quotedMessage,
  onReply,
}: {
  message: InboxMessage;
  quotedMessage?: InboxMessage | null;
  onReply?: () => void;
}) {
  const outbound = message.direction === "OUTBOUND";

  if (message.type === "SYSTEM") return <SystemLine message={message} />;

  if (message.isNote) {
    return (
      <div className="my-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 shadow-sm">
        <div className="mb-1 flex items-center gap-2">
          <Badge className="bg-amber-100 text-amber-800 ring-amber-600/20">
            <StickyNote className="mr-1 h-3 w-3" />
            Note
          </Badge>
          {message.sentBy?.name && (
            <span className="truncate text-[11px] font-medium text-amber-800">
              {message.sentBy.name}
            </span>
          )}
          <span className="ml-auto shrink-0 text-[11px] text-amber-700/70">
            {formatTime(message.createdAt)}
          </span>
        </div>
        <MessageBody message={message} tone="note" />
      </div>
    );
  }

  const replyBtn = onReply && (
    <button
      type="button"
      onClick={onReply}
      title="Reply"
      aria-label="Reply to this message"
      // Touch screens have no hover, so the button stays faintly visible there instead.
      className="mb-1 shrink-0 rounded-full p-1.5 text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-slate-600 group-hover:opacity-100 pointer-coarse:opacity-70"
    >
      <Reply className="h-3.5 w-3.5" />
    </button>
  );

  return (
    <div className={cn("group flex items-end gap-1", outbound ? "justify-end" : "justify-start")}>
      {!outbound && replyBtn}
      <div
        style={outbound ? WA_OUT : WA_IN}
        className={cn(
          // Both sides are light now, so every colour inside can come from the same
          // variables instead of a direction test. That is the whole point of setting
          // them here: `MessageBody` and its media chips used to carry seventeen
          // `outbound ? white : slate` decisions, each of which had to be found and
          // changed by hand to move off white-on-emerald.
          // `pb-4` keeps the last line clear of the timestamp, which is pinned to the
          // bottom-right corner rather than sitting on a row of its own — WhatsApp puts
          // the time in the bubble's gutter, not under the message.
          "relative min-w-0 max-w-[85%] rounded-lg px-2 pb-4 pt-1.5 text-[color:var(--wa-fg)] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] sm:max-w-[65%]",
          outbound ? "rounded-tr-none" : "rounded-tl-none",
        )}
      >
        <BubbleTail outbound={outbound} />

        {quotedMessage && (
          <div className="mb-1 overflow-hidden rounded border-l-4 border-[color:var(--wa-quote-bar)] bg-[color:var(--wa-quote-bg)] px-2 py-1">
            <p className="mb-0.5 text-xs font-medium text-[color:var(--wa-quote-bar)]">
              {quotedMessage.direction === "OUTBOUND" ? "You" : "Customer"}
            </p>
            <p className="truncate text-xs text-[color:var(--wa-meta)]">
              {quotedMessage.content ||
                (quotedMessage.type === "INTERACTIVE"
                  ? "Interactive message"
                  : `[${quotedMessage.type?.toLowerCase() ?? "message"}]`)}
            </p>
          </div>
        )}

        {message.isAiGenerated && (
          <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-[color:var(--wa-chip)] px-1.5 py-0.5 text-[10px] font-semibold text-[color:var(--wa-meta)]">
            <Sparkles className="h-3 w-3" />
            AI
          </span>
        )}

        <MessageBody message={message} tone={outbound ? "outbound" : "inbound"} />

        <KnowledgeCitation message={message} />

        <span className="pointer-events-none absolute bottom-[3px] right-[7px] flex items-center gap-1 text-[11px] leading-none text-[color:var(--wa-meta)]">
          {formatTime(message.createdAt)}
          {outbound && <StatusTick status={message.status} />}
        </span>
      </div>
      {outbound && replyBtn}
    </div>
  );
}

/**
 * WhatsApp's own two bubble colours, as variables the whole subtree reads.
 *
 * Outbound used to be solid emerald with white text, which meant every nested chip,
 * divider and caption carried its own `outbound ? … : …`. On WhatsApp both bubbles are
 * light, so the muted greys, rules and link blue are now simply the same on each side
 * and the tests disappear.
 */
const WA_IN = {
  "--wa-bg": "#ffffff",
  "--wa-fg": "#111b21",
  "--wa-meta": "rgba(17,27,33,0.45)",
  "--wa-chip": "rgba(11,20,26,0.06)",
  "--wa-rule": "rgba(11,20,26,0.09)",
  "--wa-link": "#027eb5",
  "--wa-quote-bar": "#06cf9c",
  "--wa-quote-bg": "rgba(11,20,26,0.04)",
  background: "#ffffff",
} as React.CSSProperties;

const WA_OUT = {
  ...WA_IN,
  "--wa-bg": "#d9fdd3",
  "--wa-quote-bar": "#53bdeb",
  "--wa-quote-bg": "rgba(11,20,26,0.05)",
  background: "#d9fdd3",
} as React.CSSProperties;

/** The little hook at the top corner. An SVG, because a squared-off corner is not it. */
function BubbleTail({ outbound }: { outbound: boolean }) {
  return (
    <span
      aria-hidden
      className={cn("absolute top-0 block h-[13px] w-[8px]", outbound ? "right-[-8px]" : "left-[-8px]")}
    >
      <svg viewBox="0 0 8 13" width="8" height="13" className="block">
        <path
          d={outbound ? "M0 0 L8 0 L0 13 Z" : "M8 0 L0 0 L8 13 Z"}
          fill="var(--wa-bg)"
        />
      </svg>
    </span>
  );
}

/**
 * Which knowledge documents an AI reply was grounded in.
 *
 * Recorded on the message at send time (see saveOutboundMessage in lib/inbound.ts)
 * rather than looked up now: retrieval depends on the index as it stood at that
 * moment, so re-running the search after a document was edited or deleted would
 * answer a different question.
 *
 * Shown because an AI reply is otherwise unattributable. When one turns out to be
 * wrong, the useful question is which of the workspace's documents told it that —
 * and without this line the answer is unavailable to anyone.
 */
function KnowledgeCitation({ message }: { message: InboxMessage }) {
  const raw = (message.metadata as { knowledgeSources?: unknown } | null | undefined)
    ?.knowledgeSources;
  if (!Array.isArray(raw) || raw.length === 0) return null;

  const names = raw
    .map((s) => (s && typeof s === "object" ? String((s as { name?: unknown }).name ?? "") : ""))
    .filter(Boolean);
  if (names.length === 0) return null;

  return (
    <p
      className={cn(
        "mt-1.5 border-t pt-1.5 text-[10px] leading-relaxed wrap-anywhere",
        "border-[color:var(--wa-rule)] text-[color:var(--wa-meta)]",
      )}
      title={names.join(", ")}
    >
      <BookOpen className="mr-1 inline h-3 w-3 align-[-2px]" />
      Answered from {names.join(", ")}
    </p>
  );
}

/** Centered event line — today that is a call ("Missed call", "Voice call · 2:13"). */
function SystemLine({ message }: { message: InboxMessage }) {
  const call = (message.metadata?.call ?? null) as {
    status?: string; answeredBy?: string | null; callId?: string;
  } | null;
  const status = call?.status ?? "";
  const Icon =
    status === "MISSED" ? PhoneMissed
    : status === "REJECTED" || status === "FAILED" ? PhoneOff
    : status === "RINGING" || status === "CONNECTING" || status === "IN_PROGRESS" ? PhoneIncoming
    : call ? PhoneCall : Info;
  const tone =
    status === "MISSED" || status === "FAILED" ? "bg-rose-50 text-rose-700 ring-rose-600/20"
    : status === "IN_PROGRESS" || status === "RINGING" ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
    : "bg-slate-100 text-slate-600 ring-slate-500/20";
  // Only a call that was actually answered can have audio to play.
  const playable = Boolean(call?.callId) && status === "COMPLETED";

  return (
    <div className="my-2 flex flex-col items-center gap-1">
      <span className={cn("inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1 text-xs ring-1 ring-inset", tone)}>
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">
          {message.content}
          {call?.answeredBy ? ` · ${call.answeredBy}` : ""}
        </span>
        <span className="shrink-0 opacity-60">{formatTime(message.createdAt)}</span>
      </span>
      {playable && <CallRecordingPlayer callId={call!.callId!} />}
    </div>
  );
}

/**
 * Listening back to a call without leaving the conversation.
 *
 * The recording was only reachable from the Recordings page, which meant finding the
 * right row again by time and number — while the thread the agent was already reading
 * knew exactly which call it was.
 *
 * Fetched on demand rather than with the thread: the link is presigned and short-lived,
 * and most calls in a long history are never played.
 */
function CallRecordingPlayer({ callId }: { callId: string }) {
  const [state, setState] = useState<"idle" | "loading" | "ready" | "none" | "error">("idle");
  const [url, setUrl] = useState<string | null>(null);

  async function load() {
    setState("loading");
    try {
      const res = await fetch(`/api/calls/${callId}/recording-url`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Couldn't load the recording");
      const data = json?.data ?? json;
      if (!data?.url) { setState("none"); return; }
      setUrl(data.url as string);
      setState("ready");
    } catch {
      setState("error");
    }
  }

  if (state === "ready" && url) {
    return <audio src={url} controls preload="metadata" autoPlay className="h-9 w-64 max-w-full" />;
  }

  if (state === "none") {
    return <span className="text-[11px] text-slate-400">No recording was saved for this call</span>;
  }

  return (
    <button
      type="button"
      onClick={load}
      disabled={state === "loading"}
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
    >
      <PlayCircle className="h-3.5 w-3.5" />
      {state === "loading" ? "Loading…" : state === "error" ? "Try again" : "Play recording"}
    </button>
  );
}

function MessageBody({
  message,
  tone,
}: {
  message: InboxMessage;
  tone: "inbound" | "outbound" | "note";
}) {
  const outbound = tone === "outbound";
  const caption = message.content?.trim();
  const meta = message.metadata ?? {};
  const src = mediaSrc(message);

  switch (message.type) {
    case "IMAGE":
    case "STICKER": {
      const imgSrc = src;
      return (
        <div className="space-y-1.5">
          {imgSrc ? (
            <Flush><ImageBubble src={imgSrc} alt={caption || "Attached image"} /></Flush>
          ) : (
            <MediaChip icon={ImageIcon} label="Image unavailable" />
          )}
          {caption && <p className="mt-1 whitespace-pre-wrap wrap-anywhere text-sm">{caption}</p>}
        </div>
      );
    }

    case "VIDEO": {
      const vidSrc = src;
      return (
        <div className="space-y-1.5">
          {vidSrc ? (
            <video
              src={vidSrc}
              controls
              className="max-h-64 w-full max-w-xs rounded-lg bg-black"
            />
          ) : (
            <MediaChip icon={ImageIcon} label="Video unavailable" />
          )}
          {caption && <p className="whitespace-pre-wrap wrap-anywhere text-sm">{caption}</p>}
        </div>
      );
    }

    case "AUDIO": {
      return src ? (
        <audio src={src} controls preload="metadata" className="h-9 w-56 max-w-full" />
      ) : (
        <MediaChip icon={FileText} label="Voice message" />
      );
    }

    case "DOCUMENT": {
      const filename = str(meta.filename) ?? "Document";
      const size = message.mediaSize ? formatBytes(message.mediaSize) : null;
      const docSrc = src ? (src.startsWith("/api/") ? `${src}?download=1` : src) : null;
      const chip = (
        <span
          className={cn(
            "inline-flex max-w-full items-center gap-2 rounded-lg px-2.5 py-2 ring-1 ring-inset",
            "bg-[color:var(--wa-chip)] ring-[color:var(--wa-rule)]",
          )}
        >
          <FileText className="h-5 w-5 shrink-0" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{filename}</span>
            {size && (
              <span className={cn("block text-[11px]", "text-[color:var(--wa-meta)]")}>
                {size}
              </span>
            )}
          </span>
        </span>
      );
      return (
        <div className="space-y-1.5">
          {docSrc ? (
            <a href={docSrc} target="_blank" rel="noreferrer" download={filename} className="block">
              {chip}
            </a>
          ) : (
            chip
          )}
          {caption && <p className="whitespace-pre-wrap wrap-anywhere text-sm">{caption}</p>}
        </div>
      );
    }

    case "TEMPLATE": {
      // A template is a small document — picture, heading, body, footer, buttons — and
      // the agent needs to see the same one the customer got. Showing only the body left
      // them checking a reply against something the customer never saw.
      const headerType = str(meta.headerType)?.toUpperCase() ?? null;
      const headerText = str(meta.headerText);
      const footer = str(meta.footer);
      const buttons = Array.isArray(meta.buttons)
        ? (meta.buttons as { type?: string; text?: string | null; url?: string | null }[])
        : [];
      const hasMedia = headerType === "IMAGE" || headerType === "VIDEO" || headerType === "DOCUMENT";

      return (
        <div className="space-y-1.5">
          {hasMedia && (src
            ? headerType === "IMAGE"
              ? <Flush><ImageBubble src={src} alt={headerText || "Template image"} /></Flush>
              : headerType === "VIDEO"
                ? <video src={src} controls className="max-h-64 w-full max-w-xs rounded-lg bg-black" />
                : (
                  <a href={`${src}${src.startsWith("/api/") ? "?download=1" : ""}`} target="_blank" rel="noreferrer">
                    <MediaChip icon={FileText} label="Attached document" />
                  </a>
                )
            : <MediaChip icon={ImageIcon} label="Header image unavailable" />
          )}

          {headerText && <p className="wrap-anywhere text-sm font-semibold">{headerText}</p>}

          {caption && <WaText text={caption} className="block whitespace-pre-wrap wrap-anywhere text-sm" />}

          {footer && (
            <p className={cn("text-[11px]", "text-[color:var(--wa-meta)]")}>{footer}</p>
          )}

          {buttons.length > 0 && (
            <div
              className={cn(
                "-mx-0.5 mt-1 divide-y border-t",
                "divide-[color:var(--wa-rule)] border-[color:var(--wa-rule)]",
              )}
            >
              {buttons.map((b, i) => {
                const label = b.text?.trim() || "Button";
                const inner = (
                  <span className="flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium">
                    {b.type === "URL" && <ExternalLink className="h-3 w-3" />}
                    {b.type === "PHONE_NUMBER" && <Phone className="h-3 w-3" />}
                    {label}
                  </span>
                );
                return b.type === "URL" && b.url ? (
                  <a
                    key={i}
                    href={b.url}
                    target="_blank"
                    rel="noreferrer"
                    className={cn("block", "text-[color:var(--wa-link)] hover:underline")}
                  >
                    {inner}
                  </a>
                ) : (
                  <span key={i} className={cn("block", "text-[color:var(--wa-link)]")}>
                    {inner}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    case "LOCATION": {
      const loc = (meta.location as Record<string, unknown> | undefined) ?? meta;
      const lat = num(loc.latitude);
      const lng = num(loc.longitude);
      const place = [str(loc.name), str(loc.address)].filter(Boolean).join(" · ");
      const label =
        place || (lat != null && lng != null ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : "Shared a location");
      const chip = <MediaChip icon={MapPin} label={label} />;
      return lat != null && lng != null ? (
        <a
          href={`https://maps.google.com/?q=${lat},${lng}`}
          target="_blank"
          rel="noreferrer"
          className="block"
        >
          {chip}
        </a>
      ) : (
        chip
      );
    }

    case "INTERACTIVE": {
      const interactive = meta.interactive as Record<string, unknown> | undefined;
      const bodyText = caption || (interactive?.body as { text?: string } | undefined)?.text;

      if (interactive?.type === "button") {
        const buttons =
          (interactive.action as { buttons?: Array<{ reply?: { title?: string } }> } | undefined)?.buttons ?? [];
        return (
          <div className="space-y-2">
            {bodyText && <p className="whitespace-pre-wrap wrap-anywhere text-sm">{bodyText}</p>}
            <div className="flex flex-wrap gap-1.5">
              {buttons.map((btn, i) => (
                <span
                  key={i}
                  className={cn(
                    "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset",
                    outbound
                      ? "bg-white/15 text-white ring-white/30"
                      : "bg-emerald-50 text-emerald-800 ring-emerald-200",
                  )}
                >
                  {btn.reply?.title ?? `Button ${i + 1}`}
                </span>
              ))}
            </div>
          </div>
        );
      }

      if (interactive?.type === "list") {
        const menuLabel =
          (interactive.action as { button?: string } | undefined)?.button ?? "View options";
        return (
          <div className="space-y-2">
            {bodyText && <p className="whitespace-pre-wrap wrap-anywhere text-sm">{bodyText}</p>}
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset",
                outbound
                  ? "bg-white/15 text-white ring-white/30"
                  : "bg-emerald-50 text-emerald-800 ring-emerald-200",
              )}
            >
              <LayoutList className="h-3 w-3" />
              {menuLabel}
            </span>
          </div>
        );
      }

      return (
        <p className="whitespace-pre-wrap wrap-anywhere text-sm">
          {bodyText || <span className="italic opacity-70">Interactive message</span>}
        </p>
      );
    }

    default: {
      // Reactions are stored as TEXT type with the emoji in metadata.reaction.emoji
      const reactionEmoji = str((meta as Record<string, unknown> & { reaction?: { emoji?: string } }).reaction?.emoji);
      if (reactionEmoji) {
        return <p className="text-2xl leading-none">{reactionEmoji}</p>;
      }

      // A contact card the customer shared. Meta passes these through in full, and the
      // thread used to show "Unsupported message" for one — so an agent handed a number
      // to call saw nothing at all.
      const shared = (meta as Record<string, unknown> & {
        contacts?: {
          name?: { formatted_name?: string; first_name?: string };
          phones?: { phone?: string; wa_id?: string }[];
          emails?: { email?: string }[];
          org?: { company?: string };
        }[];
      }).contacts;
      if (Array.isArray(shared) && shared.length > 0) {
        return (
          <div className="space-y-2">
            {shared.map((c, i) => {
              const who = c.name?.formatted_name?.trim() || c.name?.first_name?.trim() || "Contact";
              return (
                <div key={i} className={cn("rounded-lg px-2.5 py-2 ring-1 ring-inset",
                  "bg-[color:var(--wa-chip)] ring-[color:var(--wa-rule)]")}>
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <UserRound className="h-3.5 w-3.5 shrink-0" />
                    {who}
                  </p>
                  {c.org?.company && <p className="mt-0.5 text-xs opacity-80">{c.org.company}</p>}
                  {(c.phones ?? []).map((ph, j) => (
                    <p key={j} className="mt-0.5 font-mono text-xs opacity-90">
                      {displayPhone(ph.wa_id ?? ph.phone)}
                    </p>
                  ))}
                  {(c.emails ?? []).map((em, j) => (
                    <p key={j} className="mt-0.5 break-all text-xs opacity-90">{em.email}</p>
                  ))}
                </div>
              );
            })}
          </div>
        );
      }

      // A cart placed from the catalogue. Also passed through in full by Meta.
      const order = (meta as Record<string, unknown> & {
        order?: { text?: string; product_items?: { quantity?: number; item_price?: number; currency?: string }[] };
      }).order;
      if (order?.product_items?.length) {
        const items = order.product_items;
        const count = items.reduce((n, i) => n + (Number(i.quantity) || 0), 0);
        const total = items.reduce((t, i) => t + (Number(i.item_price) || 0) * (Number(i.quantity) || 0), 0);
        return (
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <ShoppingCart className="h-3.5 w-3.5 shrink-0" />
              Order · {count} item{count === 1 ? "" : "s"}
            </p>
            {total > 0 && (
              <p className="text-sm font-semibold">
                {items[0]?.currency ?? ""} {total.toFixed(2)}
              </p>
            )}
            {order.text && <p className="whitespace-pre-wrap text-xs opacity-80">{order.text}</p>}
          </div>
        );
      }

      // WhatsApp's own "unsupported": the customer sent something Meta will not pass on to
      // a business account — a poll, a view-once photo, a disappearing message. There is
      // no content to show and never will be. The old wording, "Unsupported message", read
      // as a fault in this app and left the agent with nothing to do about it; a thread
      // can be nothing but these, as one here is, with no hint the customer is waiting.
      if (str((meta as Record<string, unknown>).type) === "unsupported") {
        return (
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              WhatsApp couldn&apos;t deliver this message
            </p>
            <p className={cn("text-xs leading-relaxed", "text-[color:var(--wa-meta)]")}>
              They sent a type WhatsApp does not pass on to business accounts — usually a
              poll, a view-once photo or a disappearing message. Ask them to send it again
              as text, a photo or a file.
            </p>
          </div>
        );
      }

      return (
        <p className="whitespace-pre-wrap wrap-anywhere text-sm">
          {caption ? <WaText text={caption} /> : <span className="italic opacity-70">Unsupported message</span>}
        </p>
      );
    }
  }
}

function MediaChip({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm ring-1 ring-inset",
        "bg-[color:var(--wa-chip)] ring-[color:var(--wa-rule)]",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </span>
  );
}

/** An image bubble that opens a full-screen lightbox on click (Enter/Space) and ESC to close. */
/**
 * Cancels the bubble's padding so media reaches its edges.
 *
 * WhatsApp gives a photo the full width of the bubble and puts the caption underneath,
 * inside the same bubble. Ours sat inset with a gap all round, which read as a picture
 * pasted into a message rather than a picture that *is* the message.
 */
function Flush({ children }: { children: React.ReactNode }) {
  return <div className="-mx-1 -mt-0.5 overflow-hidden rounded-[7px]">{children}</div>;
}

function ImageBubble({ src, alt }: { src: string; alt: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Open image: ${alt}`}
        className="block w-full rounded-[7px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="max-h-80 w-full cursor-zoom-in rounded-[7px] object-cover"
        />
      </button>
      {open && <Lightbox src={src} alt={alt} onClose={() => setOpen(false)} />}
    </>
  );
}

function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close image"
        className="absolute right-4 top-4 rounded-lg p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
      >
        <X className="h-5 w-5" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90dvh] max-w-full rounded-lg object-contain shadow-2xl"
      />
    </div>
  );
}

function StatusTick({ status }: { status?: MessageStatus | null }) {
  switch (status) {
    case "READ":
      return <CheckCheck className="h-3.5 w-3.5 text-sky-300" aria-label="Read" />;
    case "DELIVERED":
      return <CheckCheck className="h-3.5 w-3.5" aria-label="Delivered" />;
    case "SENT":
      return <Check className="h-3.5 w-3.5" aria-label="Sent" />;
    case "FAILED":
      return <AlertCircle className="h-3.5 w-3.5 text-rose-300" aria-label="Failed to send" />;
    case "PENDING":
      return <Clock className="h-3.5 w-3.5" aria-label="Pending" />;
    default:
      return null;
  }
}

// ─── Bits ─────────────────────────────────────────────────────────────────────


function str(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

/**
 * Where a bubble loads its attachment from: the stored/public URL when the server has one, the
 * local preview while a send is in flight, otherwise the backend's message-media endpoint which
 * redirects to storage or streams from Meta.
 */
function mediaSrc(message: InboxMessage): string | null {
  if (message.mediaUrl && !message.mediaUrl.includes("graph.facebook.com")) return message.mediaUrl;
  if (message.id.startsWith("local-")) return message.mediaUrl ?? null;
  return `/api/media/message/${message.id}`;
}

function num(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
