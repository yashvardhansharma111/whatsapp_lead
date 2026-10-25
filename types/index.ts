// ─── Prisma enum mirrors (NestJS owns the DB; these keep shared code compiling) ─
export type UserRole = "OWNER" | "ADMIN" | "AGENT" | "VIEWER";
export type ConversationStatus = "OPEN" | "CLOSED" | "PENDING" | "BOT";
export type MessageType = "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" | "LOCATION" | "STICKER" | "TEMPLATE" | "INTERACTIVE" | "REACTION" | "SYSTEM";
export type MessageDirection = "INBOUND" | "OUTBOUND";
export type MessageStatus = "PENDING" | "SENT" | "DELIVERED" | "READ" | "FAILED";
export type StageOutcome = "OPEN" | "WON" | "LOST";
export type LeadScoreLabel = "COLD" | "WARM" | "HOT" | "QUALIFIED";
export type CampaignStatus = "DRAFT" | "SCHEDULED" | "RUNNING" | "PAUSED" | "COMPLETED" | "FAILED";
export type TicketStatus = "OPEN" | "ASSIGNED" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type SubscriptionStatus = "ACTIVE" | "PAST_DUE" | "CANCELED" | "TRIALING" | "INCOMPLETE";
export type BillingCycle = "MONTHLY" | "ANNUAL";

// Prisma model types are intentionally not re-exported here.
// All DB access goes through NestJS; inline types in each component/hook are preferred.

// ─── API Response Wrapper ─────────────────────────────────────────────────────
export type ApiResponse<T = unknown> =
  | { success: true; data: T; message?: string }
  | { success: false; error: string; code?: string };

// ─── Pagination ───────────────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Dashboard / Analytics ────────────────────────────────────────────────────
export interface DashboardStats {
  totalLeads: number;
  qualifiedLeads: number;
  activeConversations: number;
  totalContacts: number;
  conversionRate: number;
  campaignsSent: number;
  openTickets: number;
  messagesThisMonth: number;
}

// ─── WhatsApp Webhook Payload (Meta) ─────────────────────────────────────────
export interface WAWebhookPayload {
  object: string;
  entry: WAEntry[];
}

export interface WAEntry {
  id: string;
  changes: WAChange[];
}

export interface WAChange {
  value: WAChangeValue;
  field: string;
}

export interface WAChangeValue {
  messaging_product: string;
  metadata: { display_phone_number: string; phone_number_id: string };
  contacts?: WAContact[];
  messages?: WAMessage[];
  statuses?: WAStatus[];
}

export interface WAContact {
  profile: { name: string };
  wa_id: string;
  /** Present for individual accounts (Meta legacy field). */
  username?: string;
  /** Business WhatsApp unique ID — replaces phone number for businesses. */
  bsuid?: string;
}

export interface WAMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  image?: { id: string; mime_type: string; sha256: string; caption?: string };
  audio?: { id: string; mime_type: string };
  video?: { id: string; mime_type: string };
  document?: { id: string; mime_type: string; filename?: string };
  location?: { latitude: number; longitude: number };
  button?: { payload: string; text: string };
  interactive?: {
    type: string;
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string; description?: string };
  };
}

export interface WAStatus {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  recipient_id: string;
  errors?: Array<{ code: number; title: string }>;
}

// ─── Kanban / Lead Pipeline ───────────────────────────────────────────────────
export interface KanbanColumn {
  id: string;
  title: string;
  /** PipelineStage id this column represents. */
  stageId: string;
  color: string;
  leads: Record<string, unknown>[];
}
