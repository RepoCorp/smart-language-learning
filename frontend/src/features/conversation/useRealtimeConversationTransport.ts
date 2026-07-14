import { useEffect, useRef, useState } from "react";

import { createTopicConversationRealtimeSession } from "../../api";
import {
  CONVERSATION_MAX_CONSECUTIVE_TIMEOUTS,
  CONVERSATION_MAX_RECORDING_MS,
} from "./conversationConstants";
import type {
  BaseConversationTransportArgs,
  ConversationResponseLevel,
  ConversationSpeechSpeed,
  StartConversationTransportArgs,
} from "./conversationTransportTypes";
import { extractRealtimeText, logRealtime, type RealtimeServerEvent, warnRealtime } from "./conversationRealtimeSupport";
export function useRealtimeConversationTransport({
  sourceLanguage,
  targetLanguage,
  onError,
  onLoadingChange,
  onAssistantSpeakingChange,
  onPendingUserTurnChange,
  onConversationTurn,
  onPendingAssistantTextChange,
  speechSpeed,
  responseLevel,
}: BaseConversationTransportArgs) {
  const [conversationRecording, setConversationRecording] = useState<boolean>(false);
  const [conversationRecordingSeconds, setConversationRecordingSeconds] = useState<number>(0);
  const [conversationPaused, setConversationPaused] = useState<boolean>(false);
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
  const realtimeCompletedTurnRef = useRef<BaseConversationTransportArgs["onConversationTurn"] extends (response: infer T) => void ? T | null : null>(null);
  const realtimeAudioStoppedRef = useRef<boolean>(false);
  const setupMetricsRef = useRef<{
    sessionRequestMs: number;
    microphoneMs: number;
    offerMs: number;
    localDescriptionMs: number;
    sdpConnectMs: number;
    remoteDescriptionMs: number;
  } | null>(null);
  const timerRef = useRef<number | null>(null);
  const maxRecordingTimeoutRef = useRef<number | null>(null);
  const autoRestartAfterAssistantRef = useRef<boolean>(true);
  const activeSessionTokenRef = useRef<number>(0);
  const baseInstructionsRef = useRef<string>("");
  const timedOutSubmissionRef = useRef<boolean>(false);
  const consecutiveTimeoutCountRef = useRef<number>(0);

  const buildSpeedInstruction = (speed: ConversationSpeechSpeed): string => {
    if (speed === "super_slow") {
      return "Speak extremely slowly, like you are talking to a beginner who is just starting to learn the language. Keep that very slow pace for the entire response from beginning to end. Do not speed up at the end of the sentence. Use very short phrases, pause often, separate ideas clearly, and articulate each word carefully.";
    }
    if (speed === "slow") {
      return "Speak slowly and clearly for the entire response. Keep the same slow pace from beginning to end and do not speed up at the end.";
    }
    return "Speak at a normal pace for an A2 learner.";
  };

  const buildLevelInstruction = (level: ConversationResponseLevel): string => {
    if (level === "A1") {
      return "Use an A1 level. Use very simple words, very short sentences, and very basic grammar.";
    }
    if (level === "B1") {
      return "Use a B1 level. You can use somewhat more natural and varied vocabulary, but keep it learner-friendly.";
    }
    return "Use an A2 level. Use simple vocabulary and simple grammar.";
  };

  const buildRealtimeInstructions = (speed: ConversationSpeechSpeed, level: ConversationResponseLevel): string => {
    const baseInstructions = baseInstructionsRef.current.trim();
    const speedInstruction = buildSpeedInstruction(speed);
    const levelInstruction = buildLevelInstruction(level);
    return [baseInstructions, levelInstruction, speedInstruction].filter(Boolean).join("\n");
  };

  const sendRealtimeSessionUpdate = (
    speed: ConversationSpeechSpeed,
    level: ConversationResponseLevel,
    transcriptionModel: string,
  ): void => {
    const dataChannel = dataChannelRef.current;
    if (!dataChannel || dataChannel.readyState !== "open") {
      return;
    }
    dataChannel.send(JSON.stringify({
      type: "session.update",
      session: {
        type: "realtime",
        instructions: buildRealtimeInstructions(speed, level),
        output_modalities: ["audio"],
        audio: { input: { transcription: { model: transcriptionModel }, turn_detection: null } },
      },
    }));
  };
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

  const flushCompletedTurn = (): void => {
    const completedTurn = realtimeCompletedTurnRef.current;
    if (!completedTurn) {
      return;
    }
    onConversationTurn(completedTurn);
    realtimeCompletedTurnRef.current = null;
    realtimePendingUserTextRef.current = "";
    realtimePendingAssistantTextRef.current = "";
    realtimeAudioStoppedRef.current = false;
    onPendingAssistantTextChange("");
    onPendingUserTurnChange(false);
    onLoadingChange(false);
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
    realtimeCompletedTurnRef.current = null;
    realtimeAudioStoppedRef.current = false;
    realtimeResponseActiveRef.current = false;
    onPendingAssistantTextChange("");
    onAssistantSpeakingChange(false);
    onPendingUserTurnChange(false);
    setConversationRealtimeConnecting(false);
    setConversationRealtimeReady(false);
    setConversationRealtimeVoice("");
  };
  useEffect(() => () => {
    closeRealtimeSession();
    clearTimer();
  }, []);

  useEffect(() => {
    if (!conversationRealtimeReady) {
      return;
    }
    sendRealtimeSessionUpdate(speechSpeed, responseLevel, "gpt-4o-mini-transcribe");
  }, [conversationRealtimeReady, responseLevel, speechSpeed]);

  const startRecording = async (conversationLoading: boolean): Promise<void> => {
    if (conversationRecording || conversationLoading) {
      return;
    }
    setConversationPaused(false);
    autoRestartAfterAssistantRef.current = true;
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
    realtimeCompletedTurnRef.current = null;
    realtimeAudioStoppedRef.current = false;
    onPendingAssistantTextChange("");
    onPendingUserTurnChange(false);
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
      timedOutSubmissionRef.current = true;
      stopRecording(true);
    }, CONVERSATION_MAX_RECORDING_MS);
  };

  const setPaused = (paused: boolean): void => {
    if (!paused) {
      consecutiveTimeoutCountRef.current = 0;
    }
    setConversationPaused(paused);
    autoRestartAfterAssistantRef.current = !paused;
    if (paused && conversationRecording) {
      stopRecording(false);
    }
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
    onPendingUserTurnChange(true);
    const dataChannel = dataChannelRef.current;
    if (dataChannel && dataChannel.readyState === "open") {
      logRealtime("push-to-talk-submitted");
      dataChannel.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
      dataChannel.send(JSON.stringify({
        type: "response.create",
        response: {
          instructions: buildRealtimeInstructions(speechSpeed, responseLevel),
        },
      }));
      if (timedOutSubmissionRef.current) {
        timedOutSubmissionRef.current = false;
        consecutiveTimeoutCountRef.current += 1;
        if (consecutiveTimeoutCountRef.current >= CONVERSATION_MAX_CONSECUTIVE_TIMEOUTS) {
          setPaused(true);
        }
      } else {
        consecutiveTimeoutCountRef.current = 0;
      }
      return;
    }
    warnRealtime("submit-blocked", { dataChannelState: dataChannel?.readyState || "missing" });
    onPendingUserTurnChange(false);
    onLoadingChange(false);
    onError("Realtime connection is not ready");
  };

  const setupRealtimeConversation = async ({
    topic,
    notes,
    roleText,
    goalDifficulty,
  }: StartConversationTransportArgs): Promise<boolean> => {
    const setupStartedAt = performance.now();
    if (typeof window === "undefined" || typeof RTCPeerConnection === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      warnRealtime("unsupported");
      return false;
    }
    setConversationRealtimeConnecting(true);
    const sessionToken = activeSessionTokenRef.current + 1;
    try {
      logRealtime("setup-started", { topic, sourceLanguage, targetLanguage, goalDifficulty });
      const session = await createTopicConversationRealtimeSession(topic, notes, roleText, goalDifficulty, sourceLanguage, targetLanguage);
      const sessionRequestMs = Math.round(performance.now() - setupStartedAt);
      setupMetricsRef.current = {
        sessionRequestMs,
        microphoneMs: 0,
        offerMs: 0,
        localDescriptionMs: 0,
        sdpConnectMs: 0,
        remoteDescriptionMs: 0,
      };
      logRealtime("session-request-finished", {
        elapsedMs: sessionRequestMs,
      });
      baseInstructionsRef.current = (session.instructions || "").trim();
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
        logRealtime("setup-finished", {
          elapsedMs: Math.round(performance.now() - setupStartedAt),
        });
        logRealtime("setup-timing-summary", {
          totalElapsedMs: Math.round(performance.now() - setupStartedAt),
          sessionRequestMs: setupMetricsRef.current?.sessionRequestMs || 0,
          microphoneMs: setupMetricsRef.current?.microphoneMs || 0,
          offerMs: setupMetricsRef.current?.offerMs || 0,
          localDescriptionMs: setupMetricsRef.current?.localDescriptionMs || 0,
          sdpConnectMs: setupMetricsRef.current?.sdpConnectMs || 0,
          remoteDescriptionMs: setupMetricsRef.current?.remoteDescriptionMs || 0,
        });
        sendRealtimeSessionUpdate(
          speechSpeed,
          responseLevel,
          session.transcription_model || "gpt-4o-mini-transcribe",
        );
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
          onAssistantSpeakingChange(true);
        }
        if (eventType === "response.done" || eventType === "response.output_audio.done") {
          realtimeResponseActiveRef.current = false;
        }
        if (eventType === "output_audio_buffer.stopped") {
          realtimeResponseActiveRef.current = false;
          realtimeAudioStoppedRef.current = true;
          onAssistantSpeakingChange(false);
          flushCompletedTurn();
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
          realtimeCompletedTurnRef.current = {
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
          };
          if (realtimeAudioStoppedRef.current) {
            flushCompletedTurn();
          }
          return;
        }
        if (eventType === "output_audio_buffer.stopped" && autoRestartAfterAssistantRef.current) {
          void startRecording(false);
          return;
        }
        if (eventType === "error" || eventType === "invalid_request_error") {
          onAssistantSpeakingChange(false);
          onPendingUserTurnChange(false);
          onLoadingChange(false);
          onError(event.error?.message || event.message || "Realtime conversation error");
        }
      });
      const microphoneStartedAt = performance.now();
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (activeSessionTokenRef.current !== sessionToken) return mediaStream.getTracks().forEach((track) => track.stop()), false;
      if (setupMetricsRef.current) {
        setupMetricsRef.current.microphoneMs = Math.round(performance.now() - microphoneStartedAt);
      }
      logRealtime("microphone-ready", {
        elapsedMs: setupMetricsRef.current?.microphoneMs || Math.round(performance.now() - microphoneStartedAt),
        audioTrackCount: mediaStream.getAudioTracks().length,
      });
      const audioTrack = mediaStream.getAudioTracks()[0];
      if (!audioTrack) {
        closeRealtimeSession();
        return false;
      }
      realtimeStreamRef.current = mediaStream;
      audioTrack.enabled = false;
      peerConnection.addTrack(audioTrack, mediaStream);
      logRealtime("local-audio-track-added");
      const offerStartedAt = performance.now();
      const offer = await peerConnection.createOffer();
      if (setupMetricsRef.current) {
        setupMetricsRef.current.offerMs = Math.round(performance.now() - offerStartedAt);
      }
      logRealtime("offer-created", {
        elapsedMs: setupMetricsRef.current?.offerMs || Math.round(performance.now() - offerStartedAt),
        sdpLength: (offer.sdp || "").length,
      });
      const localDescriptionStartedAt = performance.now();
      await peerConnection.setLocalDescription(offer);
      if (setupMetricsRef.current) {
        setupMetricsRef.current.localDescriptionMs = Math.round(performance.now() - localDescriptionStartedAt);
      }
      logRealtime("local-description-set", {
        elapsedMs: setupMetricsRef.current?.localDescriptionMs || Math.round(performance.now() - localDescriptionStartedAt),
      });
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
      if (setupMetricsRef.current) {
        setupMetricsRef.current.sdpConnectMs = Math.round(performance.now() - sdpConnectStartedAt);
      }
      logRealtime("sdp-connect-succeeded", {
        elapsedMs: setupMetricsRef.current?.sdpConnectMs || Math.round(performance.now() - sdpConnectStartedAt),
        answerLength: answerSdp.length,
      });
      const remoteDescriptionStartedAt = performance.now();
      await peerConnection.setRemoteDescription({ type: "answer", sdp: answerSdp });
      if (setupMetricsRef.current) {
        setupMetricsRef.current.remoteDescriptionMs = Math.round(performance.now() - remoteDescriptionStartedAt);
      }
      logRealtime("remote-description-set", {
        elapsedMs: setupMetricsRef.current?.remoteDescriptionMs || Math.round(performance.now() - remoteDescriptionStartedAt),
      });
      return true;
    } finally {
      setConversationRealtimeConnecting(false);
    }
  };
  return {
    conversationPaused,
    conversationRecording,
    conversationRecordingSeconds,
    conversationRealtimeConnecting,
    conversationRealtimeReady,
    conversationRealtimeVoice,
    closeRealtimeSession,
    setPaused,
    setupRealtimeConversation,
    startRecording,
    stopRecording,
  };
}
