// Per-user notification preferences — mirror of backend/libs/common/src/notifications/notification-prefs.ts.

export type NotificationEvent =
  | "newMessage"
  | "missedCall"
  | "campaignCompleted"
  | "conversationAssigned"
  | "leadAssigned";

export interface ChannelPrefs {
  inApp: boolean;
  desktop: boolean;
  sound: boolean;
  email: boolean;
}

export type NotificationPrefs = Record<NotificationEvent, ChannelPrefs>;

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  newMessage:           { inApp: true, desktop: true,  sound: true,  email: false },
  missedCall:           { inApp: true, desktop: true,  sound: true,  email: false },
  campaignCompleted:    { inApp: true, desktop: false, sound: false, email: true },
  conversationAssigned: { inApp: true, desktop: true,  sound: true,  email: false },
  leadAssigned:         { inApp: true, desktop: false, sound: false, email: true },
};

export const EVENT_FOR_TYPE: Record<string, NotificationEvent | undefined> = {
  NEW_MESSAGE:           "newMessage",
  MISSED_CALL:           "missedCall",
  CAMPAIGN_COMPLETED:    "campaignCompleted",
  CONVERSATION_ASSIGNED: "conversationAssigned",
  LEAD_ASSIGNED:         "leadAssigned",
};

export const NOTIFICATION_EVENTS: { key: NotificationEvent; label: string; hint: string }[] = [
  { key: "newMessage",           label: "New message",           hint: "A customer sends a message to a conversation you can see." },
  { key: "missedCall",           label: "Missed call",           hint: "A WhatsApp call rang and nobody picked up." },
  { key: "conversationAssigned", label: "Conversation assigned", hint: "A conversation is handed to you." },
  { key: "campaignCompleted",    label: "Campaign completed",    hint: "A broadcast finishes sending to its whole audience." },
  { key: "leadAssigned",         label: "Lead assigned",         hint: "A lead is assigned to you or to someone on your team." },
];
