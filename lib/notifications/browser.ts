"use client";

// OS notifications raised by the page itself, for when the tab is open but not looked at.
//
// This is deliberately separate from web push in `./push`. Push is what reaches someone
// who has closed the app entirely; it needs a VAPID key on the server and a subscription
// per browser. What follows needs neither — it only asks the browser to draw a
// notification right now — and so it is what covers the common case of the app sitting in
// a background tab.

export type NotifyPermission = "unsupported" | "default" | "granted" | "denied";

export function notifyPermission(): NotifyPermission {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission as NotifyPermission;
}

/** What the server renders, before a browser is there to ask. */
export function notifyPermissionOnServer(): NotifyPermission {
  return "unsupported";
}

// The browser has no event for a permission changing, so answering the prompt tells any
// component reading it to look again. Shaped for `useSyncExternalStore`, which is how the
// rest of the app subscribes to things outside React.
const listeners = new Set<() => void>();

export function subscribeNotifyPermission(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/**
 * Asks to show notifications.
 *
 * Browsers only honour this from a user gesture and some permanently refuse a site that
 * asked at a bad moment, so it is never called on load — only from a control the person
 * actually clicked.
 */
export async function askNotifyPermission(): Promise<NotifyPermission> {
  if (notifyPermission() === "unsupported") return "unsupported";
  try {
    return (await Notification.requestPermission()) as NotifyPermission;
  } catch {
    return notifyPermission();
  } finally {
    listeners.forEach((l) => l());
  }
}

export interface BrowserNotice {
  title: string;
  body?: string | null;
  /** Where clicking it should land. The service worker reads this. */
  href?: string | null;
  /** Replaces an earlier notice with the same tag instead of stacking another one up. */
  tag?: string | null;
  /** Stays on screen until dismissed — for something that cannot wait, like a ringing call. */
  sticky?: boolean;
}

/**
 * Draws an OS notification. Returns false when the browser would not show one, so the
 * caller can fall back to something in-page.
 *
 * Prefers the service worker, because its `notificationclick` handler focuses the existing
 * tab and navigates it; `new Notification` is the fallback for browsers without one, and
 * mobile Chrome refuses it outright.
 */
export async function showBrowserNotice(notice: BrowserNotice): Promise<boolean> {
  if (notifyPermission() !== "granted") return false;

  const options: NotificationOptions = {
    body: notice.body ?? "",
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-72.png",
    tag: notice.tag ?? undefined,
    data: { href: notice.href ?? "/" },
    requireInteraction: notice.sticky ?? false,
  };

  try {
    const reg = await navigator.serviceWorker?.getRegistration("/");
    if (reg) {
      await reg.showNotification(notice.title, options);
      return true;
    }
  } catch {
    // Fall through to the page-level API below.
  }

  try {
    const n = new Notification(notice.title, options);
    n.onclick = () => {
      window.focus();
      if (notice.href) window.location.href = notice.href;
      n.close();
    };
    return true;
  } catch {
    return false;
  }
}
