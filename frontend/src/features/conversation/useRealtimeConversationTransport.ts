import { useEffect, useRef, useState } from "react";

import { createTopicConversationRealtimeSession } from "../../api";
import { CONVERSATION_MAX_RECORDING_MS } from "./conversationConstants";
import type {
  BaseConversationTransportArgs,
  StartConversationTransportArgs,
} from "./conversationTransportTypes";
import { extractRealtimeText, logRealtime, type RealtimeServerEvent, warnRealtime } from "./conversationRealtimeSupport";
export function useRealtimeConversationTransport({
  sourceLanguage,
  targetLanguage,
  onError,
  onLoadingChange,
  onConversationTurn,
  onPendingAssistantTextChange,
}: BaseConversationTransportArgs) {
  const [conversationRecording, setConversationRecording] = useState<boolean>(false);
  const [conversationRecordingSeconds, setConversationRecordingSeconds] = useState<number>(0);
  const [conversationRealtimeConnecting, setConversationRealtimeConnecting] = useState<boolean>(false);
  const [conversationRealtimeReady, setConversationRealtimeReady] = useState<boolean>(false);
  const [conversationRealtimeVoice, setConversationRealtimeVoice] = useState<string>("");
  const realtimeStreamRef = useRef<MediaStream | null>(null);
  const realtimeAudioRef = useRef<HTMLAudioElement | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const realtimeResponseActiveRef = useRef<boolean>(false);
  const realtimePendingUserTextRef = useRef<string>("");
  const realtimePendingAssistantTextRef = useRef<string>("");
  const timerRef = useRef<number | null>(null);
  const maxRecordingTimeoutRef = useRef<number | null>(null);
  const autoRestartAfterAssistantRef = useRef<boolean>(true);
  const activeSessionTokenRef = useRef<number>(0);
  const clearTimer = (): void => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (maxRecordingTimeoutRef.current !== null) {
      window.clearTimeout(maxRecordingTimeoutRef.current);
      maxRecordingTimeoutRef.current = null;
    }
  };

  const closeRealtimeSession = (): void => {
    activeSessionTokenRef.current += 1;
    dataChannelRef.current?.close();
    peerConnectionRef.current?.close();
    realtimeStreamRef.current?.getTracks().forEach((track) => track.stop());
    if (realtimeAudioRef.current) {
      realtimeAudioRef.current.pause();
      realtimeAudioRef.current.srcObject = null;
    }
    dataChannelRef.current = null;
    peerConnectionRef.current = null;
    realtimeStreamRef.current = null;
    realtimeAudioRef.current = null;
    realtimePendingUserTextRef.current = "";
    realtimePendingAssistantTextRef.current = "";
    realtimeResponseActiveRef.current = false;
    onPendingAssistantTextChange("");
    setConversationRealtimeConnecting(false);
    setConversationRealtimeReady(false);
    setConversationRealtimeVoice("");
  };
  useEffect(() => () => {
    closeRealtimeSession();
    clearTimer();
  }, []);

  const startRecording = async (conversationLoading: boolean): Promise<void> => {
    if (conversationRecording || conversationLoading) {
      return;
    }
    const audioTrack = realtimeStreamRef.current?.getAudioTracks()[0] || null;
    const dataChannel = dataChannelRef.current;
    if (!audioTrack || !dataChannel || dataChannel.readyState !== "open") {
      warnRealtime("recording-start-blocked", {
        hasAudioTrack: Boolean(audioTrack),
        dataChannelState: dataChannel?.readyState || "missing",
      });
      onError("Realtime connection is not ready");
      return;
    }
    onError("");
    realtimePendingUserTextRef.current = "";
    realtimePendingAssistantTextRef.current = "";
    onPendingAssistantTextChange("");
    dataChannel.send(JSON.stringify({ type: "input_audio_buffer.clear" }));
    if (realtimeResponseActiveRef.current) {
      dataChannel.send(JSON.stringify({ type: "response.cancel" }));
      dataChannel.send(JSON.stringify({ type: "output_audio_buffer.clear" }));
    }
    logRealtime("push-to-talk-started");
    audioTrack.enabled = true;
    setConversationRecording(true);
    setConversationRecordingSeconds(0);
    timerRef.current = window.setInterval(() => {
      setConversationRecordingSeconds((value) => value + 1);
    }, 1000);
    maxRecordingTimeoutRef.current = window.setTimeout(() => {
      stopRecording(true);
    }, CONVERSATION_MAX_RECORDING_MS);
  };

  const stopRecording = (submit: boolean): void => {
    const audioTrack = realtimeStreamRef.current?.getAudioTracks()[0] || null;
    if (audioTrack) {
      audioTrack.enabled = false;
    }
    clearTimer();
    setConversationRecording(false);
    setConversationRecordingSeconds(0);
    if (!submit) {
      return;
    }
    onLoadingChange(true);
    const dataChannel = dataChannelRef.current;
    if (dataChannel && dataChannel.readyState === "open") {
      logRealtime("push-to-talk-submitted");
      dataChannel.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
      dataChannel.send(JSON.stringify({ type: "response.create" }));
      return;
    }
    warnRealtime("submit-blocked", { dataChannelState: dataChannel?.readyState || "missing" });
    onLoadingChange(false);
    onError("Realtime connection is not ready");
  };

  const setupRealtimeConversation = async ({
    topic,
    notes,
    roleText,
    goalDifficulty,
  }: StartConversationTransportArgs): Promise<boolean> => {
    if (typeof window === "undefined" || typeof RTCPeerConnection === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      warnRealtime("unsupported");
      return false;
    }
    setConversationRealtimeConnecting(true);
    const sessionToken = activeSessionTokenRef.current + 1;
    try {
      logRealtime("setup-started", { topic, sourceLanguage, targetLanguage, goalDifficulty });
      const session = await createTopicConversationRealtimeSession(topic, notes, roleText, goalDifficulty, sourceLanguage, targetLanguage);
      logRealtime("session-response", {
        realtimeEnabled: session.realtime_enabled,
        hasClientSecret: Boolean(session.client_secret?.value),
        voice: session.voice || "",
        model: session.model || "",
      });
      const ephemeralKey = session.client_secret?.value?.trim() || "";
      if (!session.realtime_enabled || !ephemeralKey) {
        warnRealtime(!session.realtime_enabled ? "session-disabled" : "missing-client-secret");
        return false;
      }
      closeRealtimeSession();
      activeSessionTokenRef.current = sessionToken;
      const peerConnection = new RTCPeerConnection();
      const dataChannel = peerConnection.createDataChannel("oai-events");
      const remoteAudio = document.createElement("audio");
      remoteAudio.autoplay = true;
      remoteAudio.setAttribute("playsinline", "true");
      realtimeAudioRef.current = remoteAudio;
      peerConnectionRef.current = peerConnection;
      dataChannelRef.current = dataChannel;

      peerConnection.ontrack = (event) => {
        if (activeSessionTokenRef.current !== sessionToken) return;
        remoteAudio.srcObject = event.streams[0];
        logRealtime("remote-audio-track", { streamCount: event.streams.length });
        void remoteAudio.play().catch(() => {});
      };
      peerConnection.addEventListener("connectionstatechange", () => logRealtime("peer-connection-state", { state: peerConnection.connectionState }));
      peerConnection.addEventListener("iceconnectionstatechange", () => logRealtime("ice-connection-state", { state: peerConnection.iceConnectionState }));

      dataChannel.addEventListener("open", () => {
        if (activeSessionTokenRef.current !== sessionToken) return;
        logRealtime("data-channel-open");
        dataChannel.send(JSON.stringify({
          type: "session.update",
          session: {
            type: "realtime",
            output_modalities: ["audio"],
            audio: { input: { transcription: { model: session.transcription_model || "gpt-4o-mini-transcribe" }, turn_detection: null } },
          },
        }));
        setConversationRealtimeReady(true);
        setConversationRealtimeVoice(session.voice || "");
      });

      dataChannel.addEventListener("message", (messageEvent) => {
        if (activeSessionTokenRef.current !== sessionToken) return;
        let event: RealtimeServerEvent;
        try {
          event = JSON.parse(messageEvent.data) as RealtimeServerEvent;
        } catch {
          warnRealtime("message-parse-failed");
          return;
        }
        const eventType = String(event.type || "");
        if (eventType) {
          logRealtime("server-event", { type: eventType });
        }
        if (eventType === "response.created" || eventType === "output_audio_buffer.started") {
          realtimeResponseActiveRef.current = true;
        }
        if (eventType === "response.done" || eventType === "output_audio_buffer.stopped" || eventType === "response.output_audio.done") {
          realtimeResponseActiveRef.current = false;
        }
        if (eventType === "conversation.item.input_audio_transcription.completed" || eventType === "conversation.item.input_audio_transcription.done") {
          const transcript = (typeof event.transcript === "string" ? event.transcript : typeof event.item?.content?.[0]?.transcript === "string" ? event.item.content[0].transcript : "").trim();
          realtimePendingUserTextRef.current = transcript;
          return;
        }
        if (eventType === "response.output_audio_transcript.delta" && typeof event.delta === "string") {
          realtimePendingAssistantTextRef.current += event.delta;
          onPendingAssistantTextChange(realtimePendingAssistantTextRef.current);
          return;
        }
        if (eventType === "response.output_audio_transcript.done") {
          const assistantText = (typeof event.transcript === "string" ? event.transcript : "").trim();
          if (assistantText) {
            realtimePendingAssistantTextRef.current = assistantText;
            onPendingAssistantTextChange(assistantText);
          }
          return;
        }
        if (eventType === "response.done") {
          const assistantText = extractRealtimeText(event) || realtimePendingAssistantTextRef.current.trim();
          onConversationTurn({
            user_text: realtimePendingUserTextRef.current.trim(),
            user_translation_text: "",
            user_corrected_text: "",
            user_corrected_translation_text: "",
            user_correction_explanation: "",
            user_is_grammatically_correct: true,
            user_makes_sense_in_context: true,
            user_needs_correction: false,
            assistant_text: assistantText,
            assistant_translation_text: "",
            assistant_audio_url: "",
            goal_achieved: false,
            goal_achievement_message: "",
            next_goal_suggestion: "",
          });
          realtimePendingUserTextRef.current = "";
          realtimePendingAssistantTextRef.current = "";
          onPendingAssistantTextChange("");
          onLoadingChange(false);
          return;
        }
        if (eventType === "output_audio_buffer.stopped" && autoRestartAfterAssistantRef.current) {
          void startRecording(false);
          return;
        }
        if (eventType === "error" || eventType === "invalid_request_error") {
          onLoadingChange(false);
          onError(event.error?.message || event.message || "Realtime conversation error");
        }
      });
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (activeSessionTokenRef.current !== sessionToken) return mediaStream.getTracks().forEach((track) => track.stop()), false;
      const audioTrack = mediaStream.getAudioTracks()[0];
      if (!audioTrack) {
        closeRealtimeSession();
        return false;
      }
      realtimeStreamRef.current = mediaStream;
      audioTrack.enabled = false;
      peerConnection.addTrack(audioTrack, mediaStream);
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      const sdpResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        body: offer.sdp,
        headers: { Authorization: `Bearer ${ephemeralKey}`, "Content-Type": "application/sdp" },
      });
      if (!sdpResponse.ok) {
        throw new Error("Failed to connect Realtime audio session");
      }
      await peerConnection.setRemoteDescription({ type: "answer", sdp: await sdpResponse.text() });
      return true;
    } finally {
      setConversationRealtimeConnecting(false);
    }
  };
  return {
    conversationRecording,
    conversationRecordingSeconds,
    conversationRealtimeConnecting,
    conversationRealtimeReady,
    conversationRealtimeVoice,
    closeRealtimeSession,
    setupRealtimeConversation,
    startRecording,
    stopRecording,
  };
}
