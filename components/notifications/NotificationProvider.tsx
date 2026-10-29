"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { useRealtimeEvent } from "@/hooks/useRealtime";
import { useNotificationPrefs, useNotificationsRealtime } from "@/hooks/useNotifications";
import { EVENT_FOR_TYPE } from "@/lib/notifications/prefs";
import { registerServiceWorker } from "@/lib/notifications/push";
import type { RtNotification } from "@/lib/realtime/events";

/**
 * Turns `notification:new` into a toast (+ sound) while this tab is open, and keeps the
 * service worker registered so OS notifications arrive when it is not. The worker only
 * shows a notification when no tab is focused, so a user never gets both at once.
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
    if (document.visibilityState !== "visible") return; // the service worker covers hidden tabs

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
