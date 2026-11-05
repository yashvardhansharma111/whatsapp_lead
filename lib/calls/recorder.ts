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
 *
 * Every step logs under one prefix. A recording that fails leaves nothing behind to
 * inspect — the audio is gone and the call is over — so the trace has to be written as it
 * happens rather than reconstructed afterwards. Filter the console by `[call-rec]`.
 */

const TAG = "[call-rec]";
const log  = (...a: unknown[]) => console.log(TAG, ...a);
const warn = (...a: unknown[]) => console.warn(TAG, ...a);

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

  if (typeof supported !== "function") {
    warn("MediaRecorder.isTypeSupported missing — letting the browser choose");
    return undefined;
  }
  const picked = candidates.find((t) => supported.call(null, t));
  log("mime support:", candidates.map((t) => `${t}=${supported.call(null, t)}`).join("  "));
  return picked;
}

/** What a stream is carrying, for the log line. Nothing here identifies a person. */
function describe(label: string, stream: MediaStream | null | undefined): string {
  if (!stream) return `${label}=none`;
  const tracks = stream.getAudioTracks();
  if (!tracks.length) return `${label}=0 audio tracks`;
  return `${label}=${tracks
    .map((t) => `${t.kind}:${t.readyState}${t.enabled ? "" : ":disabled"}${t.muted ? ":muted" : ""}`)
    .join(",")}`;
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

  log("start requested ·", describe("mic", localStream), "·", describe("remote", remoteStream));

  if (!AudioCtx) {
    warn("no AudioContext in this browser — cannot mix the two sides, recording skipped");
    return null;
  }
  if (typeof MediaRecorder === "undefined") {
    warn("no MediaRecorder in this browser — recording skipped");
    return null;
  }

  try {
    const ctx = new AudioCtx();
    log("AudioContext state:", ctx.state, "sampleRate:", ctx.sampleRate);

    // An AudioContext created without a user gesture starts suspended, and a suspended
    // context produces silence — which is exactly the "file arrived but empty" case.
    if (ctx.state === "suspended") {
      void ctx.resume().then(
        () => log("AudioContext resumed"),
        (e) => warn("AudioContext would not resume:", e?.message ?? e),
      );
    }

    // One destination both sides are routed into, so the file holds a single mixed track
    // rather than two that have to be lined up again later.
    const mixer = ctx.createMediaStreamDestination();
    let connected = 0;
    for (const [name, stream] of [["mic", localStream], ["remote", remoteStream]] as const) {
      if (stream?.getAudioTracks().length) {
        ctx.createMediaStreamSource(stream).connect(mixer);
        connected++;
        log(`routed ${name} into the mixer`);
      } else {
        warn(`${name} has no audio track — that side will be silent`);
      }
    }
    if (!connected) {
      warn("neither side had audio — nothing to record");
      void ctx.close().catch(() => {});
      return null;
    }

    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(mixer.stream, mimeType ? { mimeType } : undefined);
    log("MediaRecorder created ·", "mime:", recorder.mimeType || "(browser default)");

    const chunks: BlobPart[] = [];
    let bytes = 0;
    recorder.ondataavailable = (e) => {
      if (e.data?.size) {
        chunks.push(e.data);
        bytes += e.data.size;
        // One line a second would drown the console on a long call; every tenth is enough
        // to show it is still producing audio.
        if (chunks.length === 1 || chunks.length % 10 === 0) {
          log(`chunk ${chunks.length} · ${bytes} bytes so far`);
        }
      } else {
        warn("empty chunk — the mixer is producing silence");
      }
    };
    recorder.onerror = (e) => warn("MediaRecorder error:", (e as unknown as { error?: Error }).error ?? e);

    // A chunk a second, so an interrupted call still yields whatever was captured up to
    // the moment it stopped instead of one buffer that is lost entirely.
    recorder.start(1000);
    log("recording started · state:", recorder.state);
    const startedAt = Date.now();

    return {
      elapsed: () => Math.round((Date.now() - startedAt) / 1000),
      stop: () =>
        new Promise<Blob | null>((resolve) => {
          const seconds = Math.round((Date.now() - startedAt) / 1000);
          log(`stop requested after ${seconds}s · state: ${recorder.state} · ${chunks.length} chunks · ${bytes} bytes`);

          const finish = () => {
            void ctx.close().catch(() => {});
            if (!chunks.length) {
              warn("no chunks captured — nothing will be uploaded");
              return resolve(null);
            }
            const blob = new Blob(chunks, { type: mimeType ?? "audio/webm" });
            log(`blob ready · ${blob.size} bytes · ${blob.type}`);
            resolve(blob);
          };

          if (recorder.state === "inactive") {
            log("recorder already inactive");
            return finish();
          }
          recorder.onstop = () => { log("onstop fired · final chunks:", chunks.length); finish(); };
          try {
            recorder.stop();
          } catch (e) {
            warn("stop() threw:", (e as Error)?.message ?? e);
            finish();
          }
        }),
    };
  } catch (e) {
    warn("could not start recording:", (e as Error)?.message ?? e);
    return null;
  }
}

/**
 * Sends a finished recording to the server.
 *
 * @returns null on success, or the reason it failed. The caller decides whether that is
 *   worth telling anyone — it is never raised mid-call. Returning the reason rather than
 *   a bare false matters because a failed upload is otherwise invisible: the only trace
 *   is a status code in a console nobody has open.
 */
export async function uploadCallRecording(
  callId: string,
  blob: Blob,
  durationSec: number,
): Promise<string | null> {
  log(`upload starting · call ${callId} · ${blob.size} bytes · ${blob.type} · ${durationSec}s`);

  if (!blob.size) {
    warn("blob is empty — not uploading");
    return "The recording captured no audio.";
  }

  try {
    const form = new FormData();
    form.append("file", blob, `call-${callId}.webm`);
    form.append("durationSec", String(durationSec));
    log("form parts:", [...form.keys()].join(", "));

    const startedAt = Date.now();
    const res = await fetch(`/api/calls/${callId}/recording`, { method: "POST", body: form });
    const text = await res.text();
    log(`upload answered ${res.status} in ${Date.now() - startedAt}ms · ${text.slice(0, 300)}`);

    if (res.ok) return null;

    let json: { error?: string; message?: string } | null = null;
    try { json = JSON.parse(text); } catch { /* not JSON */ }
    return json?.error ?? json?.message ?? `Upload failed (${res.status}).`;
  } catch (err) {
    warn("upload threw:", (err as Error)?.message ?? err);
    return err instanceof Error ? err.message : "Upload failed.";
  }
}
