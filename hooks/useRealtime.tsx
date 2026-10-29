"use client";

import {
  createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode,
} from "react";
import { getSocket, type RealtimeSocket } from "@/lib/realtime/client";
import type { RealtimeEventName, RealtimeEvents } from "@/lib/realtime/events";

interface RealtimeCtx {
  socket: RealtimeSocket | null;
  connected: boolean;
}

const Ctx = createContext<RealtimeCtx>({ socket: null, connected: false });

const noop = () => {};

/**
 * Owns the one Socket.IO connection for the dashboard. Mounted once in the
 * dashboard layout; everything below reads events through `useRealtimeEvent`.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [socket] = useState<RealtimeSocket | null>(() => (typeof window === "undefined" ? null : getSocket()));

  const connected = useSyncExternalStore(
    (onChange) => {
      if (!socket) return noop;
      socket.on("connect", onChange);
      socket.on("disconnect", onChange);
      return () => {
        socket.off("connect", onChange);
        socket.off("disconnect", onChange);
      };
    },
    () => socket?.connected ?? false,
    () => false,
  );

  useEffect(() => {
    if (!socket) return;
    const sendPresence = () => {
      if (socket.connected) socket.emit("presence", { visible: document.visibilityState === "visible" });
    };
    socket.on("connect", sendPresence);
    document.addEventListener("visibilitychange", sendPresence);
    if (!socket.connected) socket.connect();
    return () => {
      socket.off("connect", sendPresence);
      document.removeEventListener("visibilitychange", sendPresence);
    };
  }, [socket]);

  return <Ctx.Provider value={{ socket, connected }}>{children}</Ctx.Provider>;
}

export function useRealtime(): RealtimeCtx {
  return useContext(Ctx);
}

/** Subscribes to one server event for the lifetime of the component. Handler identity may change freely. */
export function useRealtimeEvent<E extends RealtimeEventName>(
  event: E,
  handler: (payload: RealtimeEvents[E]) => void,
) {
  const { socket } = useRealtime();
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });

  useEffect(() => {
    if (!socket) return;
    const listener = (payload: RealtimeEvents[E]) => ref.current(payload);
    // socket.io's typed `on` can't express the generic event name; the catalog guarantees the shape.
    (socket as unknown as { on: (e: string, l: typeof listener) => void }).on(event, listener);
    return () => {
      (socket as unknown as { off: (e: string, l: typeof listener) => void }).off(event, listener);
    };
  }, [socket, event]);
}

/** Runs on every (re)connect after the first — the moment to refetch anything that may have been missed. */
export function useRealtimeReconnect(handler: () => void) {
  const { socket } = useRealtime();
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });

  useEffect(() => {
    if (!socket) return;
    let seen = socket.connected;
    const onConnect = () => {
      if (seen) ref.current();
      seen = true;
    };
    socket.on("connect", onConnect);
    return () => {
      socket.off("connect", onConnect);
    };
  }, [socket]);
}
