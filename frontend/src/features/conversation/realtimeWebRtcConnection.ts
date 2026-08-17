import { logRealtime } from "./conversationRealtimeSupport";

type RealtimeConnectionMetrics = {
  microphoneMs: number;
  offerMs: number;
  localDescriptionMs: number;
  sdpConnectMs: number;
  remoteDescriptionMs: number;
};

type RealtimeWebRtcConnectionOptions = {
  ephemeralKey: string;
  isSessionActive: () => boolean;
  onResourcesReady: (resources: {
    peerConnection: RTCPeerConnection;
    dataChannel: RTCDataChannel;
    mediaStream: MediaStream;
    remoteAudio: HTMLAudioElement;
  }) => void;
  onDataChannelOpen: () => void;
  onDataChannelMessage: (event: MessageEvent) => void;
  onNoAudioTrack: () => void;
};

export async function connectRealtimeWebRtc({
  ephemeralKey,
  isSessionActive,
  onResourcesReady,
  onDataChannelOpen,
  onDataChannelMessage,
  onNoAudioTrack,
}: RealtimeWebRtcConnectionOptions): Promise<RealtimeConnectionMetrics | null> {
  const peerConnection = new RTCPeerConnection();
  const dataChannel = peerConnection.createDataChannel("oai-events");
  const remoteAudio = document.createElement("audio");
  remoteAudio.autoplay = true;
  remoteAudio.setAttribute("playsinline", "true");

  peerConnection.ontrack = (event) => {
    if (!isSessionActive()) return;
    remoteAudio.srcObject = event.streams[0];
    logRealtime("remote-audio-track", { streamCount: event.streams.length });
    void remoteAudio.play().catch(() => {});
  };
  peerConnection.addEventListener("connectionstatechange", () => logRealtime("peer-connection-state", { state: peerConnection.connectionState }));
  peerConnection.addEventListener("iceconnectionstatechange", () => logRealtime("ice-connection-state", { state: peerConnection.iceConnectionState }));
  dataChannel.addEventListener("open", () => {
    if (isSessionActive()) {
      onDataChannelOpen();
    }
  });
  dataChannel.addEventListener("message", (event) => {
    if (isSessionActive()) {
      onDataChannelMessage(event);
    }
  });

  const microphoneStartedAt = performance.now();
  const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  if (!isSessionActive()) {
    mediaStream.getTracks().forEach((track) => track.stop());
    peerConnection.close();
    return null;
  }
  const metrics: RealtimeConnectionMetrics = {
    microphoneMs: Math.round(performance.now() - microphoneStartedAt),
    offerMs: 0,
    localDescriptionMs: 0,
    sdpConnectMs: 0,
    remoteDescriptionMs: 0,
  };
  logRealtime("microphone-ready", { elapsedMs: metrics.microphoneMs, audioTrackCount: mediaStream.getAudioTracks().length });
  const audioTrack = mediaStream.getAudioTracks()[0];
  if (!audioTrack) {
    mediaStream.getTracks().forEach((track) => track.stop());
    peerConnection.close();
    onNoAudioTrack();
    return null;
  }
  audioTrack.enabled = false;
  peerConnection.addTrack(audioTrack, mediaStream);
  onResourcesReady({ peerConnection, dataChannel, mediaStream, remoteAudio });
  logRealtime("local-audio-track-added");

  const offerStartedAt = performance.now();
  const offer = await peerConnection.createOffer();
  metrics.offerMs = Math.round(performance.now() - offerStartedAt);
  logRealtime("offer-created", { elapsedMs: metrics.offerMs, sdpLength: (offer.sdp || "").length });
  const localDescriptionStartedAt = performance.now();
  await peerConnection.setLocalDescription(offer);
  metrics.localDescriptionMs = Math.round(performance.now() - localDescriptionStartedAt);
  logRealtime("local-description-set", { elapsedMs: metrics.localDescriptionMs });
  const sdpConnectStartedAt = performance.now();
  const sdpResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
    method: "POST",
    body: offer.sdp,
    headers: { Authorization: `Bearer ${ephemeralKey}`, "Content-Type": "application/sdp" },
  });
  if (!sdpResponse.ok) {
    throw new Error("Failed to connect Realtime audio session");
  }
  const answerSdp = await sdpResponse.text();
  metrics.sdpConnectMs = Math.round(performance.now() - sdpConnectStartedAt);
  logRealtime("sdp-connect-succeeded", { elapsedMs: metrics.sdpConnectMs, answerLength: answerSdp.length });
  const remoteDescriptionStartedAt = performance.now();
  await peerConnection.setRemoteDescription({ type: "answer", sdp: answerSdp });
  metrics.remoteDescriptionMs = Math.round(performance.now() - remoteDescriptionStartedAt);
  logRealtime("remote-description-set", { elapsedMs: metrics.remoteDescriptionMs });
  return metrics;
}
