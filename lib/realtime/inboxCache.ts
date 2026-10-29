// Pure reducers that apply realtime inbox events to the react-query caches.
//
// Two cache shapes exist under the ["conversations", …] prefix:
//   list   → { data: Conversation[], … }            (["conversations", filters])
//   detail → { data: { ...conversation, messages } } (["conversations", id])
// Every reducer accepts either and leaves anything it doesn't recognise untouched.

import type { RtConversationSummary, RtMessage, RtStatusUpdate } from "./events";

type Row = Record<string, unknown> & { id?: string };
type Envelope = { data?: unknown } & Record<string, unknown>;

function isEnvelope(v: unknown): v is Envelope {
  return Boolean(v) && typeof v === "object";
}

function listRows(cache: unknown): Row[] | null {
  if (!isEnvelope(cache) || !Array.isArray(cache.data)) return null;
  return cache.data as Row[];
}

function detailRow(cache: unknown): (Row & { messages?: Row[] }) | null {
  if (!isEnvelope(cache)) return null;
  const d = cache.data;
  if (!d || typeof d !== "object" || Array.isArray(d)) return null;
  return d as Row & { messages?: Row[] };
}

function withList(cache: Envelope, rows: Row[]): Envelope {
  return { ...cache, data: rows };
}

function withDetail(cache: Envelope, row: Row): Envelope {
  return { ...cache, data: row };
}

/** The id the optimistic placeholder was inserted under (see useSendMessage). */
export const localMessageId = (clientId: string) => `local-${clientId}`;

function clientIdOf(m: Row): string | null {
  const meta = m.metadata as Record<string, unknown> | null | undefined;
  const v = meta?.clientId;
  return typeof v === "string" ? v : null;
}

/** Appends a message to the open thread, replacing its optimistic placeholder if one exists. */
export function upsertMessage(messages: Row[], message: Row): Row[] {
  const clientId = clientIdOf(message);
  const byId = messages.findIndex((m) => m.id === message.id);
  if (byId >= 0) {
    const next = messages.slice();
    next[byId] = { ...messages[byId], ...message };
    return next;
  }
  if (clientId) {
    const local = messages.findIndex((m) => m.id === localMessageId(clientId) || clientIdOf(m) === clientId);
    if (local >= 0) {
      const next = messages.slice();
      // Keep the local preview URL when the server row has no public media URL yet.
      next[local] = { ...message, mediaUrl: message.mediaUrl ?? messages[local].mediaUrl ?? null };
      return next;
    }
  }
  return [...messages, message];
}

/** Swaps the optimistic placeholder for the row the send request returned. */
export function applyServerMessage(cache: unknown, conversationId: string, message: Row): unknown {
  const detail = detailRow(cache);
  if (!detail || detail.id !== conversationId) return cache;
  const messages = Array.isArray(detail.messages) ? detail.messages : [];
  return withDetail(cache as Envelope, { ...detail, messages: upsertMessage(messages, message) });
}

/** Moves/creates the conversation row in a list and refreshes its preview fields. */
export function upsertConversationRow(rows: Row[], summary: RtConversationSummary): Row[] {
  const idx = rows.findIndex((r) => r.id === summary.id);
  const patch = {
    lastMessageAt: summary.lastMessageAt,
    lastMessagePreview: summary.lastMessagePreview,
    unreadCount: summary.unreadCount,
    status: summary.status,
    assignedToId: summary.assignedToId,
    isAiActive: summary.isAiActive,
  };
  if (idx >= 0) {
    const updated = { ...rows[idx], ...patch, contact: { ...(rows[idx].contact as Row | undefined), ...summary.contact } };
    return [updated, ...rows.slice(0, idx), ...rows.slice(idx + 1)];
  }
  return [{ id: summary.id, contactId: summary.contactId, contact: summary.contact, ...patch }, ...rows];
}

export function applyMessageNew(cache: unknown, message: RtMessage, summary: RtConversationSummary): unknown {
  const rows = listRows(cache);
  if (rows) return withList(cache as Envelope, upsertConversationRow(rows, summary));

  const detail = detailRow(cache);
  if (detail && detail.id === message.conversationId) {
    const messages = Array.isArray(detail.messages) ? detail.messages : [];
    return withDetail(cache as Envelope, {
      ...detail,
      lastMessageAt: summary.lastMessageAt,
      lastMessagePreview: summary.lastMessagePreview,
      messages: upsertMessage(messages, message as unknown as Row),
    });
  }
  return cache;
}

export function applyMessageUpdated(cache: unknown, messageId: string, conversationId: string, patch: Partial<RtMessage>): unknown {
  const detail = detailRow(cache);
  if (!detail || detail.id !== conversationId || !Array.isArray(detail.messages)) return cache;
  let touched = false;
  const messages = detail.messages.map((m) => {
    if (m.id !== messageId) return m;
    touched = true;
    return { ...m, ...patch };
  });
  return touched ? withDetail(cache as Envelope, { ...detail, messages }) : cache;
}

export function applyStatusUpdates(cache: unknown, updates: RtStatusUpdate[]): unknown {
  const detail = detailRow(cache);
  if (!detail || !Array.isArray(detail.messages)) return cache;
  const mine = updates.filter((u) => u.conversationId === detail.id);
  if (mine.length === 0) return cache;
  const byId = new Map(mine.map((u) => [u.messageId, u]));
  let touched = false;
  const messages = detail.messages.map((m) => {
    const u = byId.get(m.id as string);
    if (!u) return m;
    touched = true;
    const meta = (m.metadata as Record<string, unknown> | null) ?? null;
    return {
      ...m,
      status: u.status,
      ...(u.errorTitle ? { metadata: { ...meta, error: { code: u.errorCode, title: u.errorTitle } } } : {}),
    };
  });
  return touched ? withDetail(cache as Envelope, { ...detail, messages }) : cache;
}

export function applyConversationPatch(cache: unknown, id: string, patch: Partial<RtConversationSummary>): unknown {
  const rows = listRows(cache);
  if (rows) {
    let touched = false;
    const next = rows.map((r) => {
      if (r.id !== id) return r;
      touched = true;
      return { ...r, ...patch, ...(patch.contact ? { contact: { ...(r.contact as Row | undefined), ...patch.contact } } : {}) };
    });
    return touched ? withList(cache as Envelope, next) : cache;
  }
  const detail = detailRow(cache);
  if (detail && detail.id === id) {
    return withDetail(cache as Envelope, {
      ...detail,
      ...patch,
      ...(patch.contact ? { contact: { ...(detail.contact as Row | undefined), ...patch.contact } } : {}),
    });
  }
  return cache;
}

/** Inserts the optimistic placeholder for an outbound send. */
export function applyOptimisticSend(cache: unknown, conversationId: string, message: Row): unknown {
  const detail = detailRow(cache);
  if (detail && detail.id === conversationId) {
    const messages = Array.isArray(detail.messages) ? detail.messages : [];
    return withDetail(cache as Envelope, {
      ...detail,
      lastMessageAt: message.createdAt,
      lastMessagePreview: previewOf(message),
      messages: upsertMessage(messages, message),
    });
  }
  const rows = listRows(cache);
  if (rows) {
    const idx = rows.findIndex((r) => r.id === conversationId);
    if (idx < 0) return cache;
    const updated = { ...rows[idx], lastMessageAt: message.createdAt, lastMessagePreview: previewOf(message), unreadCount: 0 };
    return withList(cache as Envelope, [updated, ...rows.slice(0, idx), ...rows.slice(idx + 1)]);
  }
  return cache;
}

/** Marks an optimistic placeholder as failed (kept in the thread so the agent sees why). */
export function applySendFailed(cache: unknown, conversationId: string, clientId: string, reason: string): unknown {
  return applyMessageUpdated(cache, localMessageId(clientId), conversationId, {
    status: "FAILED",
    metadata: { clientId, error: { title: reason } },
  });
}

/** Drops an optimistic placeholder (used when the agent dismisses a failed send). */
export function removeMessage(cache: unknown, conversationId: string, messageId: string): unknown {
  const detail = detailRow(cache);
  if (!detail || detail.id !== conversationId || !Array.isArray(detail.messages)) return cache;
  const messages = detail.messages.filter((m) => m.id !== messageId);
  return messages.length === detail.messages.length ? cache : withDetail(cache as Envelope, { ...detail, messages });
}

const TYPE_PREVIEW: Record<string, string> = {
  IMAGE: "📷 Photo", VIDEO: "🎥 Video", AUDIO: "🎵 Voice message", DOCUMENT: "📄 Document",
  STICKER: "😊 Sticker", INTERACTIVE: "💬 Interactive",
};

function previewOf(message: Row): string {
  const content = typeof message.content === "string" ? message.content.trim() : "";
  if (content) return content.slice(0, 100);
  return TYPE_PREVIEW[String(message.type ?? "")] ?? "📎 Attachment";
}
