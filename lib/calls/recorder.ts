/**
 * Records both sides of a WhatsApp call in the agent's browser.
 *
 * The audio of a WhatsApp call travels straight between the customer's phone and this
 * browser — it never passes through Meta's servers or ours — so there is no server in the
 * media path to record from. Putting one there would mean running a media server, which
 * is a separate service with its own cost and its own added latency. Mixing the two
 * streams here and uploading the result costs nothing and needs no new infrastructure.
 *
 * The honest consequence, which the UI says rather than hides: this recording only
 * survives if the tab stays open to the end of the call. A closed tab or a dropped
 * connection means an incomplete recording or none at all, and nothing is uploaded unless
 * audio was actually captured.
 */

export interface CallRecorder {
  /** Resolves to the captured audio, or null when nothing usable was recorded. */
  stop(): Promise<Blob | null>;
  /** Seconds captured so far. */
  elapsed(): number;
}

/** The first container the browser will actually produce, best quality first. */
function pickMimeType(): string | undefined {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  const supported = (window as unknown as {
    MediaRecorder?: { isTypeSupported?: (t: string) => boolean };
  }).MediaRecorder?.isTypeSupported;

  if (typeof supported !== "function") return undefined;
  return candidates.find((t) => supported.call(null, t));
}

/**
 * Starts recording the two streams as one track.
 *
 * Returns null — rather than throwing — when the browser has no MediaRecorder or refuses
 * to start. A call that cannot be recorded must still connect; losing the recording is a
 * far smaller harm than dropping the call to preserve it.
 */
export function startCallRecorder(
  localStream: MediaStream,
  remoteStream: MediaStream,
): CallRecorder | null {
  const AudioCtx =
    (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
      .AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioCtx || typeof MediaRecorder === "undefined") return null;

  try {
    const ctx = new AudioCtx();
    // One destination both sides are routed into, so the file holds a single mixed track
    // rather than two that have to be lined up again later.
    const mixer = ctx.createMediaStreamDestination();
    for (const stream of [localStream, remoteStream]) {
      if (stream.getAudioTracks().length) ctx.createMediaStreamSource(stream).connect(mixer);
    }

    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(mixer.stream, mimeType ? { mimeType } : undefined);
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data?.size) chunks.push(e.data);
    };

    // A chunk a second, so an interrupted call still yields whatever was captured up to
    // the moment it stopped instead of one buffer that is lost entirely.
    recorder.start(1000);
    const startedAt = Date.now();

    return {
      elapsed: () => Math.round((Date.now() - startedAt) / 1000),
      stop: () =>
        new Promise<Blob | null>((resolve) => {
          const finish = () => {
            void ctx.close().catch(() => {});
            resolve(chunks.length ? new Blob(chunks, { type: mimeType ?? "audio/webm" }) : null);
          };
          if (recorder.state === "inactive") return finish();
          recorder.onstop = finish;
          try {
            recorder.stop();
          } catch {
            finish();
          }
        }),
    };
  } catch {
    return null;
  }
}

/** Sends a finished recording to the server. Failure is logged, never surfaced mid-call. */
export async function uploadCallRecording(
  callId: string,
  blob: Blob,
  durationSec: number,
): Promise<boolean> {
  if (!blob.size) return false;
  try {
    const form = new FormData();
    form.append("file", blob, `call-${callId}.webm`);
    form.append("durationSec", String(durationSec));
    const res = await fetch(`/api/calls/${callId}/recording`, { method: "POST", body: form });
    return res.ok;
  } catch {
    return false;
  }
}
