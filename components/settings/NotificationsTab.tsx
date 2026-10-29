"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Save } from "lucide-react";
import { Button, Card } from "@/components/ui";

type Channel = "email" | "inApp";

const EVENTS = [
  {
    key: "newMessage",
    label: "New message",
    hint: "A customer sends a message to an unassigned conversation.",
  },
  {
    key: "leadAssigned",
    label: "Lead assigned",
    hint: "A lead is assigned to you or to someone on your team.",
  },
  {
    key: "slaBreach",
    label: "Ticket SLA breach",
    hint: "A ticket passes its SLA deadline without being resolved.",
  },
  {
    key: "campaignCompleted",
    label: "Campaign completed",
    hint: "A broadcast finishes sending to its whole audience.",
  },
  {
    key: "weeklySummary",
    label: "Weekly summary",
    hint: "A digest of conversations, leads and revenue every Monday.",
  },
] as const;

type EventKey = (typeof EVENTS)[number]["key"];

const DEFAULTS: Record<EventKey, Record<Channel, boolean>> = {
  newMessage:        { email: false, inApp: true },
  leadAssigned:      { email: true,  inApp: true },
  slaBreach:         { email: true,  inApp: true },
  campaignCompleted: { email: true,  inApp: false },
  weeklySummary:     { email: true,  inApp: false },
};

const STORAGE_KEY = "waboxa:notification_prefs";

function loadPrefs(): Record<EventKey, Record<Channel, boolean>> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Record<EventKey, Record<Channel, boolean>>>;
    // Merge with defaults so newly added events get their defaults
    const merged = { ...DEFAULTS };
    for (const key of Object.keys(DEFAULTS) as EventKey[]) {
      if (parsed[key]) merged[key] = { ...DEFAULTS[key], ...parsed[key] };
    }
    return merged;
  } catch {
    return DEFAULTS;
  }
}

export function NotificationsTab() {
  const [prefs, setPrefs] = useState<Record<EventKey, Record<Channel, boolean>>>(DEFAULTS);
  const [saved, setSaved] = useState(false);

  // Load from storage on mount
  useEffect(() => {
    setPrefs(loadPrefs());
  }, []);

  const toggle = (key: EventKey, channel: Channel) =>
    setPrefs((p) => ({ ...p, [key]: { ...p[key], [channel]: !p[key][channel] } }));

  const save = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // localStorage may be blocked in private mode — silently continue
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="font-semibold text-slate-900">Notifications</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Choose how you want to hear about each event. Settings are saved to this browser.
        </p>
      </div>

      {/* Column headers */}
      <div className="hidden items-center gap-4 border-b border-slate-200 bg-slate-50 px-5 py-2 text-xs font-medium uppercase tracking-wide text-slate-500 sm:flex">
        <span className="flex-1">Event</span>
        <span className="w-16 text-center">Email</span>
        <span className="w-16 text-center">In-app</span>
      </div>

      <ul className="divide-y divide-slate-100">
        {EVENTS.map((e) => (
          <li key={e.key} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-800">{e.label}</p>
              <p className="mt-0.5 text-xs text-slate-500">{e.hint}</p>
            </div>

            <div className="flex gap-6 sm:gap-0">
              <label className="flex min-h-10 cursor-pointer items-center gap-2 sm:min-h-0 sm:w-16 sm:justify-center">
                <input
                  type="checkbox"
                  checked={prefs[e.key].email}
                  onChange={() => toggle(e.key, "email")}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  aria-label={`${e.label} — email`}
                />
                <span className="text-xs text-slate-500 sm:hidden">Email</span>
              </label>
              <label className="flex min-h-10 cursor-pointer items-center gap-2 sm:min-h-0 sm:w-16 sm:justify-center">
                <input
                  type="checkbox"
                  checked={prefs[e.key].inApp}
                  onChange={() => toggle(e.key, "inApp")}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  aria-label={`${e.label} — in-app`}
                />
                <span className="text-xs text-slate-500 sm:hidden">In-app</span>
              </label>
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
        <Button onClick={save}>
          <Save className="h-4 w-4" />
          Save preferences
        </Button>
      </div>
    </Card>
  );
}
