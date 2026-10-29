"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Loader2, Mic, MicOff, Phone, PhoneOff } from "lucide-react";
import { Avatar } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { useFeature } from "@/hooks/useFeature";
import { useRealtimeEvent } from "@/hooks/useRealtime";
import { callApi } from "@/hooks/useCalls";
import { buildAnswer, formatCallDuration, type PeerConnectionLike } from "@/lib/calls/webrtc";
import type { RtCallIncoming, RtCallStatus } from "@/lib/realtime/events";
import { cn } from "@/lib/utils";

interface ActiveCall {
  call: RtCallIncoming;
  pc: PeerConnectionLike;
  mic: MediaStream;
  answeredAt: number;
}

/**
 * Rings, answers and ends WhatsApp calls anywhere in the dashboard. One banner per
 * ringing call; one connected call at a time. Mounted once in the dashboard layout
 * and inert when the plan has no calling.
 */
export function CallProvider({ children }: { children: ReactNode }) {
  const enabled = useFeature("callingEnabled");
  return (
    <>
      {children}
      {enabled && <CallManager />}
    </>
  );
}

function CallManager() {
  const { showToast } = useToast();
  const router = useRouter();
  const { data: session } = useSession();
  const myId = session?.user?.id;

  const [ringing, setRinging] = useState<RtCallIncoming[]>([]);
  const [active, setActive] = useState<ActiveCall | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const activeRef = useRef<ActiveCall | null>(null);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  const remoteAudio = useRef<HTMLAudioElement | null>(null);
  const ringtone = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const el = new Audio("/sounds/ring.wav");
    el.loop = true;
    el.preload = "auto";
    ringtone.current = el;
    return () => {
      el.pause();
    };
  }, []);

  // Ring while anything is ringing and nothing is connected.
  useEffect(() => {
    const el = ringtone.current;
    if (!el) return;
    if (ringing.length > 0 && !active) {
      el.currentTime = 0;
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, [ringing.length, active]);

  // Flash the tab title so a ringing call is noticed from another tab.
  useEffect(() => {
    if (ringing.length === 0) return;
    const original = document.title;
    const who = ringing[0].contact.name || ringing[0].contact.phone || "WhatsApp";
    let on = false;
    const t = setInterval(() => {
      on = !on;
      document.title = on ? `📞 ${who} is calling…` : original;
    }, 1000);
    return () => {
      clearInterval(t);
      document.title = original;
    };
  }, [ringing]);

  const endLocal = useCallback((reason?: string, kind: "info" | "error" = "info") => {
    const a = activeRef.current;
    if (a) {
      try { a.pc.close(); } catch { /* already closed */ }
      a.mic.getTracks().forEach((t) => t.stop());
    }
    if (remoteAudio.current) remoteAudio.current.srcObject = null;
    setActive(null);
    setMuted(false);
    if (reason) showToast(reason, kind);
  }, [showToast]);

  useRealtimeEvent("call:incoming", (call) => {
    setRinging((prev) => (prev.some((c) => c.id === call.id) ? prev : [...prev, call]));
  });

  useRealtimeEvent("call:status", (status: RtCallStatus) => {
    if (status.status !== "RINGING") setRinging((prev) => prev.filter((c) => c.id !== status.id));

    if (status.status === "IN_PROGRESS" && status.answeredBy && status.answeredBy.id !== myId) {
      showToast(`Call answered by ${status.answeredBy.name ?? "a teammate"}`, "info");
    }
    const a = activeRef.current;
    if (a && a.call.id === status.id) {
      if (status.status === "COMPLETED") endLocal(status.durationSec != null ? `Call ended · ${formatCallDuration(status.durationSec)}` : "Call ended");
      else if (status.status === "FAILED") endLocal(status.errorTitle ? `Call failed: ${status.errorTitle}` : "Call failed", "error");
      else if (status.status === "MISSED" || status.status === "REJECTED") endLocal("Call ended");
    }
  });

  // Local expiry so a banner never outlives Meta's answer window if a webhook is lost.
  useEffect(() => {
    if (ringing.length === 0) return;
    const timers = ringing.map((c) =>
      setTimeout(() => setRinging((prev) => prev.filter((x) => x.id !== c.id)), Math.max(0, new Date(c.expiresAt).getTime() - Date.now())),
    );
    return () => timers.forEach(clearTimeout);
  }, [ringing]);

  async function accept(call: RtCallIncoming) {
    if (active || connectingId) return;
    setConnectingId(call.id);
    let mic: MediaStream | null = null;
    let pc: PeerConnectionLike | null = null;
    try {
      mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      const iceServers = await callApi.iceServers();
      const offerSdp = await fetchOffer(call.id);
      const built = await buildAnswer({
        offerSdp, iceServers, stream: mic,
        onRemoteTrack: (stream) => {
          if (remoteAudio.current) {
            remoteAudio.current.srcObject = stream;
            remoteAudio.current.play().catch(() => {});
          }
        },
      });
      pc = built.pc;
      await callApi.accept(call.id, built.sdp);
      setRinging((prev) => prev.filter((c) => c.id !== call.id));
      setActive({ call, pc, mic, answeredAt: Date.now() });

      const native = pc as unknown as RTCPeerConnection;
      native.addEventListener?.("connectionstatechange", () => {
        if (native.connectionState === "failed") {
          void callApi.hangup(call.id).catch(() => {});
          endLocal("Call connection failed", "error");
        }
      });
    } catch (err) {
      mic?.getTracks().forEach((t) => t.stop());
      try { pc?.close(); } catch { /* ignore */ }
      const name = err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "NotFoundError");
      showToast(name ? "Microphone access is needed to answer calls" : err instanceof Error ? err.message : "Couldn't answer the call", "error");
      if (err instanceof Error && /already answered|no longer ringing|expired/i.test(err.message)) {
        setRinging((prev) => prev.filter((c) => c.id !== call.id));
      }
    } finally {
      setConnectingId(null);
    }
  }

  async function decline(call: RtCallIncoming) {
    setRinging((prev) => prev.filter((c) => c.id !== call.id));
    await callApi.reject(call.id).catch(() => {});
  }

  async function hangup() {
    const a = activeRef.current;
    if (!a) return;
    const id = a.call.id;
    endLocal();
    await callApi.hangup(id).catch((err) => showToast(err instanceof Error ? err.message : "Couldn't end the call", "error"));
  }

  function toggleMute() {
    const a = activeRef.current;
    if (!a) return;
    const next = !muted;
    a.mic.getAudioTracks().forEach((t) => { t.enabled = !next; });
    setMuted(next);
  }

  const banner = ringing.find((c) => c.id !== active?.call.id);

  return (
    <>
      <audio ref={remoteAudio} autoPlay playsInline className="hidden" />
      {banner && (
        <IncomingCallBanner
          call={banner}
          connecting={connectingId === banner.id}
          disabled={Boolean(active) || Boolean(connectingId && connectingId !== banner.id)}
          onAccept={() => accept(banner)}
          onDecline={() => decline(banner)}
          onOpen={() => banner.conversationId && router.push(`/inbox?c=${banner.conversationId}`)}
        />
      )}
      {active && (
        <InCallPanel
          call={active.call}
          answeredAt={active.answeredAt}
          muted={muted}
          onMute={toggleMute}
          onHangup={hangup}
          onOpen={() => active.call.conversationId && router.push(`/inbox?c=${active.call.conversationId}`)}
        />
      )}
    </>
  );
}

/** The SDP offer rides on the socket event only for the agent who answers; fetch it fresh on accept. */
async function fetchOffer(callId: string): Promise<string> {
  const res = await fetch(`/api/calls/${callId}`);
  const json = await res.json().catch(() => ({}));
  const data = json?.data ?? json;
  if (!res.ok) throw new Error(json?.error ?? "Call not found");
  const sdp = data?.offerSdp;
  if (typeof sdp !== "string" || !sdp) throw new Error("The call expired before it could be answered");
  return sdp;
}

function IncomingCallBanner({
  call, connecting, disabled, onAccept, onDecline, onOpen,
}: {
  call: RtCallIncoming;
  connecting: boolean;
  disabled: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onOpen: () => void;
}) {
  const [left, setLeft] = useState(() => secondsLeft(call.expiresAt));
  useEffect(() => {
    const t = setInterval(() => setLeft(secondsLeft(call.expiresAt)), 1000);
    return () => clearInterval(t);
  }, [call.expiresAt]);

  const name = call.contact.name || call.contact.phone || "Unknown caller";
  return (
    <div
      role="dialog"
      aria-live="assertive"
      aria-label={`Incoming call from ${name}`}
      className="fixed bottom-4 right-4 z-[9998] w-[min(22rem,calc(100vw-2rem))] rounded-2xl bg-slate-900 p-4 text-white shadow-2xl ring-1 ring-white/10"
    >
      <div className="flex items-center gap-3">
        <span className="relative">
          <Avatar name={name} size="lg" />
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-4 w-4 rounded-full bg-emerald-500" />
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{name}</p>
          {call.contact.name && call.contact.phone && <p className="truncate text-xs text-white/60">+{call.contact.phone}</p>}
          <p className="mt-0.5 text-[11px] text-white/50">
            Incoming WhatsApp call{call.displayPhoneNumber ? ` · ${call.displayPhoneNumber}` : ""} · {left}s
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={onDecline}
          disabled={connecting}
          className="flex h-10 items-center justify-center gap-2 rounded-xl bg-rose-600 text-sm font-semibold transition hover:bg-rose-500 disabled:opacity-50"
        >
          <PhoneOff className="h-4 w-4" />
          Decline
        </button>
        <button
          onClick={onAccept}
          disabled={disabled || connecting}
          className="flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-500 text-sm font-semibold transition hover:bg-emerald-400 disabled:opacity-50"
        >
          {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
          {connecting ? "Connecting…" : "Accept"}
        </button>
      </div>
      {call.conversationId && (
        <button onClick={onOpen} className="mt-2 w-full text-center text-[11px] text-white/50 hover:text-white/80">
          Open conversation
        </button>
      )}
    </div>
  );
}

function InCallPanel({
  call, answeredAt, muted, onMute, onHangup, onOpen,
}: {
  call: RtCallIncoming;
  answeredAt: number;
  muted: boolean;
  onMute: () => void;
  onHangup: () => void;
  onOpen: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - answeredAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [answeredAt]);

  const name = call.contact.name || call.contact.phone || "Unknown caller";
  return (
    <div
      role="status"
      aria-label={`On a call with ${name}`}
      className="fixed bottom-4 right-4 z-[9998] flex w-[min(22rem,calc(100vw-2rem))] items-center gap-3 rounded-2xl bg-slate-900 p-3 text-white shadow-2xl ring-1 ring-white/10"
    >
      <Avatar name={name} size="md" />
      <button onClick={onOpen} className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-semibold">{name}</p>
        <p className="text-xs tabular-nums text-emerald-300">{formatCallDuration(elapsed)}</p>
      </button>
      <button
        onClick={onMute}
        aria-pressed={muted}
        aria-label={muted ? "Unmute microphone" : "Mute microphone"}
        className={cn("flex h-10 w-10 items-center justify-center rounded-full transition", muted ? "bg-white text-slate-900" : "bg-white/10 hover:bg-white/20")}
      >
        {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      </button>
      <button
        onClick={onHangup}
        aria-label="Hang up"
        className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-600 transition hover:bg-rose-500"
      >
        <PhoneOff className="h-4 w-4" />
      </button>
    </div>
  );
}

function secondsLeft(expiresAt: string) {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
}
