// Realtime event catalog — mirror of backend/libs/common/src/realtime/events.ts.
// Keep the two files identical; the server emits exactly these shapes.

export interface RtAgent {
  id: string;
  name: string | null;
}

export interface RtMessage {
  id: string;
  conversationId: string;
  direction: "INBOUND" | "OUTBOUND";
  type: string;
  content: string | null;
  mediaUrl: string | null;
  mediaMimeType: string | null;
  mediaSize: number | null;
  metadata: Record<string, unknown> | null;
  status: string;
  isNote: boolean;
  isAiGenerated: boolean;
  replyToId: string | null;
  createdAt: string;
  sentBy: RtAgent | null;
}

export interface RtConversationSummary {
  id: string;
  contactId: string;
  contact: { id: string; name: string | null; phone: string | null; avatarUrl: string | null };
  status: string;
  assignedToId: string | null;
  isAiActive: boolean;
  unreadCount: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
}

export interface RtStatusUpdate {
  messageId: string;
  conversationId: string;
  status: string;
  errorCode?: number;
  errorTitle?: string;
}

export interface RtCampaignProgress {
  id: string;
  status: string;
  totalCount: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  repliedCount: number;
  failedCount: number;
  costMinor: number;
  completedAt: string | null;
}

export interface RtNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  businessId: string | null;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export interface RtCallIncoming {
  id: string;
  waCallId: string;
  contact: { id: string; name: string | null; phone: string | null };
  conversationId: string | null;
  integrationId: string;
  displayPhoneNumber: string | null;
  ringingSince: string;
  expiresAt: string;
}

export interface RtCallStatus {
  id: string;
  status: string;
  answeredBy?: RtAgent | null;
  durationSec?: number | null;
  errorTitle?: string | null;
}

/** Server → client events. */
export interface RealtimeEvents {
  "message:new": { message: RtMessage; conversation: RtConversationSummary };
  "message:updated": { messageId: string; conversationId: string; patch: Partial<RtMessage> };
  "message:status": { updates: RtStatusUpdate[] };
  "conversation:updated": { id: string; patch: Partial<RtConversationSummary> };
  "campaign:progress": RtCampaignProgress;
  "notification:new": RtNotification;
  "notification:updated": RtNotification;
  "notification:count": { unread: number };
  "call:incoming": RtCallIncoming;
  "call:status": RtCallStatus;
}

export type RealtimeEventName = keyof RealtimeEvents;

/** Client → server events. */
export interface RealtimeClientEvents {
  presence: { visible: boolean };
}
