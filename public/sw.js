/* Service worker: shows web push notifications only when no tab is focused, and
   focuses/opens the app when one is clicked. No caching — the app is always online. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Waboxa", body: event.data ? event.data.text() : "" };
  }

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const focused = windows.find((c) => c.focused);
      if (focused) {
        // An open, focused tab shows its own toast — just let it know.
        focused.postMessage({ type: "push", payload });
        return;
      }
      await self.registration.showNotification(payload.title || "Waboxa", {
        body: payload.body || "",
        icon: "/icons/icon-192.png",
        badge: "/icons/badge-72.png",
        tag: payload.tag || payload.id || undefined,
        renotify: Boolean(payload.tag),
        data: { href: payload.href || "/", id: payload.id || null, type: payload.type || null },
        requireInteraction: payload.type === "MISSED_CALL",
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = (event.notification.data && event.notification.data.href) || "/";
  const target = new URL(href, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = windows.find((c) => new URL(c.url).origin === self.location.origin);
      if (existing) {
        await existing.focus();
        if ("navigate" in existing) await existing.navigate(target);
        return;
      }
      await self.clients.openWindow(target);
    })(),
  );
});
