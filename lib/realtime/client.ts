"use client";

import { io, type Socket } from "socket.io-client";
import type { RealtimeClientEvents, RealtimeEvents } from "./events";

type ServerToClient = { [E in keyof RealtimeEvents]: (payload: RealtimeEvents[E]) => void };
type ClientToServer = { [E in keyof RealtimeClientEvents]: (payload: RealtimeClientEvents[E]) => void };

export type RealtimeSocket = Socket<ServerToClient, ClientToServer>;

let socket: RealtimeSocket | null = null;

async function fetchTicket(): Promise<{ token: string; url: string }> {
  const res = await fetch("/api/realtime/ticket", { cache: "no-store" });
  if (!res.ok) throw new Error(`ticket ${res.status}`);
  return res.json();
}

/**
 * One socket per tab. The handshake token is a short-lived backend JWT minted by
 * `/api/realtime/ticket`; socket.io calls `auth` again on every reconnect, so an
 * expired token is replaced without any bookkeeping here.
 */
export function getSocket(): RealtimeSocket {
  if (socket) return socket;

  const url = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";
  socket = io(`${url}/rt`, {
    autoConnect: false,
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10_000,
    // A free ngrok tunnel answers browser-looking requests with its own interstitial
    // page, which the polling transport would receive instead of the handshake. The
    // header opts out of it and is ignored by every other host.
    extraHeaders: { "ngrok-skip-browser-warning": "1" },
    auth: (cb) => {
      fetchTicket()
        .then((t) => cb({ token: t.token }))
        .catch(() => cb({ token: "" }));
    },
  }) as RealtimeSocket;

  return socket;
}

/** Drops the current connection so the next `getSocket()` handshakes fresh (e.g. after sign-out). */
export function resetSocket() {
  socket?.disconnect();
  socket = null;
}
