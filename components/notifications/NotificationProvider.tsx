"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { useRealtimeEvent } from "@/hooks/useRealtime";
import { useNotificationPrefs, useNotificationsRealtime } from "@/hooks/useNotifications";
import { EVENT_FOR_TYPE } from "@/lib/notifications/prefs";
import { registerServiceWorker } from "@/lib/notifications/push";
import { showBrowserNotice } from "@/lib/notifications/browser";
import type { RtNotification } from "@/lib/realtime/events";

/**
 * Decides where a notification is shown.
 *
 * Looking at the tab, it is a toast, because an OS notification for something already on
 * screen is just noise. Looking elsewhere, the browser draws it, so it is seen at all.
 * Never both, and never nothing.
 */
export function NotificationProvider({ children }: { children: ReactNode }) {
  const { showToast } = useToast();
  const router = useRouter();
  const { data: prefs } = useNotificationPrefs();
  const audio = useRef<HTMLAudioElement | null>(null);

  useNotificationsRealtime();

  useEffect(() => {
    void registerServiceWorker();
    audio.current = new Audio("/sounds/notify.wav");
    audio.current.preload = "auto";
  }, []);

  const handle = (n: RtNotification) => {
    const event = EVENT_FOR_TYPE[n.type];
    const channel = event && prefs ? prefs[event] : { inApp: true, sound: false };
    if (!channel.inApp) return;

    // Not looking at this tab: hand it to the browser. Push would only reach someone who
    // closed the app, and it needs a server key, so this is what covers a background tab.
    if (document.visibilityState !== "visible") {
      void showBrowserNotice({
        title: n.title,
        body:  n.body,
        href:  n.href,
        tag:   (n.data?.dedupeKey as string | undefined) ?? n.id,
      });
      return;
    }

    showToast({
      kind: "notification",
      title: n.title,
      description: n.body ?? undefined,
      key: (n.data?.dedupeKey as string | undefined) ?? n.id,
      action: n.href ? { label: "Open", onClick: () => router.push(n.href!) } : undefined,
    });
    if (channel.sound && audio.current) {
      audio.current.currentTime = 0;
      audio.current.play().catch(() => {}); // autoplay may be blocked until the first interaction
    }
  };

  useRealtimeEvent("notification:new", handle);
  useRealtimeEvent("notification:updated", handle);

  return <>{children}</>;
}
