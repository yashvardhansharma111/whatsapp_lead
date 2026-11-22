"use client";

import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRealtime, useRealtimeEvent, useRealtimeReconnect } from "@/hooks/useRealtime";

export type PresenceState = "ONLINE" | "AWAY" | "BUSY" | "OFFLINE";

/**
 * Your own status, and whether you chose it.
 *
 * Online and offline follow the socket, because that is the only honest source: a laptop
 * closing does not get to tell the server anything, so a stored "online" is a claim
 * nobody ever retracts. Away and Busy are stored, because they have to survive a reload
 * and be visible to a colleague who was not connected when you set them.
 *
 * The header used to keep this in a `useState` that reset to "Online" on every reload and
 * that nobody else could see.
 */
export function useMyPresence() {
  const { connected } = useRealtime();
  const [override, setOverride] = useState<"AWAY" | "BUSY" | null>(null);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  // The server is the authority on the override — another tab may have changed it.
  useRealtimeEvent("presence:update", (p) => {
    if (!p.manual) setOverride(null);
    else if (p.state === "AWAY" || p.state === "BUSY") setOverride(p.state);
    void queryClient.invalidateQueries({ queryKey: ["conversation-agents"] });
  });

  useEffect(() => {
    let cancelled = false;
    // `/api/auth/me` is not a route — it fell into NextAuth's catch-all and answered 400
    // on every page load, which this `.catch` then hid. The stored Away/Busy therefore
    // never came back after a reload.
    void fetch("/api/conversations/presence")
      .then((r) => r.json())
      .then((j) => {
        const u = (j?.data ?? j) as { presenceStatus?: string | null };
        if (!cancelled && (u?.presenceStatus === "AWAY" || u?.presenceStatus === "BUSY")) {
          setOverride(u.presenceStatus);
        }
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const state: PresenceState = override ?? (connected ? "ONLINE" : "OFFLINE");

  const choose = useCallback(async (next: "AWAY" | "BUSY" | null) => {
    setSaving(true);
    setOverride(next);                       // the dot answers immediately
    try {
      const res = await fetch("/api/conversations/presence", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error("rejected");
    } catch {
      setOverride(null);                     // put it back rather than lie
    } finally {
      setSaving(false);
    }
  }, []);

  useRealtimeReconnect(() => {
    void queryClient.invalidateQueries({ queryKey: ["conversation-agents"] });
  });

  return { state, manual: override !== null, choose, saving };
}
