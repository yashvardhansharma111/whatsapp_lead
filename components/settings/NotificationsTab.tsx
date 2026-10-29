"use client";

import { useEffect, useState } from "react";
import { BellOff, BellRing, CheckCircle2, Loader2, Save } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { useNotificationPrefs, useSaveNotificationPrefs } from "@/hooks/useNotifications";
import {
  DEFAULT_NOTIFICATION_PREFS, NOTIFICATION_EVENTS, type ChannelPrefs, type NotificationEvent, type NotificationPrefs,
} from "@/lib/notifications/prefs";
import { currentPushState, disablePush, enablePush, type PushState } from "@/lib/notifications/push";

type Channel = keyof ChannelPrefs;

const CHANNELS: { key: Channel; label: string }[] = [
  { key: "inApp", label: "In-app" },
  { key: "desktop", label: "Desktop" },
  { key: "sound", label: "Sound" },
  { key: "email", label: "Email" },
];

export function NotificationsTab() {
  const { data: serverPrefs } = useNotificationPrefs();
  const save = useSaveNotificationPrefs();
  const { showToast } = useToast();

  // The server copy is shown until the user edits; `draft` holds their unsaved changes.
  const [draft, setDraft] = useState<NotificationPrefs | null>(null);
  const prefs = draft ?? serverPrefs ?? DEFAULT_NOTIFICATION_PREFS;
  const dirty = draft !== null;
  const [saved, setSaved] = useState(false);
  const [push, setPush] = useState<PushState>("off");
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    void currentPushState().then(setPush);
  }, []);

  const toggle = (key: NotificationEvent, channel: Channel) =>
    setDraft({ ...prefs, [key]: { ...prefs[key], [channel]: !prefs[key][channel] } });

  async function handleSave() {
    try {
      await save.mutateAsync(prefs);
      setDraft(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Couldn't save preferences", "error");
    }
  }

  async function togglePush() {
    setPushBusy(true);
    try {
      const next = push === "on" ? await disablePush() : await enablePush();
      setPush(next);
      if (next === "blocked") showToast("Notifications are blocked for this site in your browser settings.", "error");
      if (next === "on") showToast("Desktop notifications are on for this browser.", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Couldn't change desktop notifications", "error");
    } finally {
      setPushBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            {push === "on" ? <BellRing className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
          </span>
          <div>
            <p className="text-sm font-medium text-slate-900">Desktop notifications on this device</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {push === "unsupported"
                ? "This browser can't show system notifications."
                : push === "blocked"
                  ? "Blocked in your browser. Allow notifications for this site, then try again."
                  : push === "on"
                    ? "You'll get a system notification for the events below when this tab isn't in front."
                    : "Turn on to get system notifications when you're in another tab or the app is closed."}
            </p>
          </div>
        </div>
        <Button
          variant={push === "on" ? "secondary" : "primary"}
          onClick={togglePush}
          disabled={pushBusy || push === "unsupported" || push === "blocked"}
          className="shrink-0"
        >
          {pushBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {push === "on" ? "Turn off" : "Turn on"}
        </Button>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Notifications</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Choose how you want to hear about each event. In-app shows a toast and the bell; Desktop is the
            system notification when you&apos;re away; Sound plays with the toast.
          </p>
        </div>

        <div className="hidden items-center gap-4 border-b border-slate-200 bg-slate-50 px-5 py-2 text-xs font-medium uppercase tracking-wide text-slate-500 sm:flex">
          <span className="flex-1">Event</span>
          {CHANNELS.map((c) => (
            <span key={c.key} className="w-16 text-center">{c.label}</span>
          ))}
        </div>

        <ul className="divide-y divide-slate-100">
          {NOTIFICATION_EVENTS.map((e) => (
            <li key={e.key} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800">{e.label}</p>
                <p className="mt-0.5 text-xs text-slate-500">{e.hint}</p>
              </div>
              <div className="flex flex-wrap gap-5 sm:gap-0">
                {CHANNELS.map((c) => (
                  <label key={c.key} className="flex min-h-10 cursor-pointer items-center gap-2 sm:min-h-0 sm:w-16 sm:justify-center">
                    <input
                      type="checkbox"
                      checked={prefs[e.key][c.key]}
                      onChange={() => toggle(e.key, c.key)}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      aria-label={`${e.label} — ${c.label}`}
                    />
                    <span className="text-xs text-slate-500 sm:hidden">{c.label}</span>
                  </label>
                ))}
              </div>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-4 max-sm:[&>button]:h-10 max-sm:[&>button]:w-full">
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              Saved
            </span>
          )}
          <Button onClick={handleSave} disabled={save.isPending || !dirty}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save preferences
          </Button>
        </div>
      </Card>
    </div>
  );
}
