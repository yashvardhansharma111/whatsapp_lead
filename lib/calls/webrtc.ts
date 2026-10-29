// WebRTC helpers for answering WhatsApp calls. Meta's Calling API has no trickle ICE:
// the SDP answer we POST must already contain our ICE candidates, so we wait for
// gathering to finish (bounded) before reading localDescription.

export interface IceServer {
  urls: string[];
  username?: string;
  credential?: string;
}

/** The slice of RTCPeerConnection the helpers use — lets tests pass a fake. */
export interface PeerConnectionLike {
  iceGatheringState: RTCIceGatheringState;
  localDescription: { sdp?: string } | null;
  addTrack(track: MediaStreamTrack, stream: MediaStream): unknown;
  setRemoteDescription(desc: { type: "offer" | "answer"; sdp: string }): Promise<void>;
  createAnswer(): Promise<{ type?: string; sdp?: string }>;
  setLocalDescription(desc: { type?: string; sdp?: string }): Promise<void>;
  addEventListener(type: string, listener: (ev: unknown) => void): void;
  removeEventListener(type: string, listener: (ev: unknown) => void): void;
  close(): void;
}

export const ICE_GATHER_TIMEOUT_MS = 4000;

/** Resolves once ICE gathering completes, or after `timeoutMs` with whatever was gathered. */
export function waitForIceGathering(pc: PeerConnectionLike, timeoutMs = ICE_GATHER_TIMEOUT_MS): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      pc.removeEventListener("icegatheringstatechange", onChange);
      resolve();
    };
    const onChange = () => {
      if (pc.iceGatheringState === "complete") finish();
    };
    const timer = setTimeout(finish, timeoutMs);
    pc.addEventListener("icegatheringstatechange", onChange);
  });
}

export interface BuildAnswerInput {
  offerSdp: string;
  iceServers: IceServer[];
  /** The agent's microphone. */
  stream: MediaStream;
  onRemoteTrack: (stream: MediaStream) => void;
  /** Injectable for tests; defaults to the browser's RTCPeerConnection. */
  createPeerConnection?: (config: { iceServers: IceServer[] }) => PeerConnectionLike;
}

/** Builds the SDP answer for Meta's offer. The caller owns `pc` from here (hang-up closes it). */
export async function buildAnswer(input: BuildAnswerInput): Promise<{ pc: PeerConnectionLike; sdp: string }> {
  const create =
    input.createPeerConnection ??
    ((config: { iceServers: IceServer[] }) =>
      new RTCPeerConnection({ iceServers: config.iceServers, bundlePolicy: "max-bundle" }) as unknown as PeerConnectionLike);

  const pc = create({ iceServers: input.iceServers });

  // A fresh MediaStream per remote track: re-using one stream object doesn't re-bind <audio>.
  pc.addEventListener("track", (ev) => {
    const track = (ev as { track?: MediaStreamTrack }).track;
    if (track) input.onRemoteTrack(new MediaStream([track]));
  });

  for (const track of input.stream.getTracks()) pc.addTrack(track, input.stream);

  await pc.setRemoteDescription({ type: "offer", sdp: input.offerSdp });
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  await waitForIceGathering(pc);

  const sdp = pc.localDescription?.sdp ?? answer.sdp ?? "";
  if (!sdp) {
    pc.close();
    throw new Error("Could not build a WebRTC answer");
  }
  return { pc, sdp };
}

export function formatCallDuration(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
