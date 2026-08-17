import { useEffect, useRef, useState } from "react";

import {
  CONVERSATION_MAX_CONSECUTIVE_TIMEOUTS,
  CONVERSATION_MAX_RECORDING_MS,
} from "./conversationConstants";
import { buildRealtimeInstructions, buildRealtimeSessionUpdate } from "./conversationRealtimeInstructions";
import { startRealtimeConversationSession } from "./realtimeSessionSetup";
import { useRealtimeActiveAudioUsage } from "./useRealtimeActiveAudioUsage";
import type {
  BaseConversationTransportArgs,
  ConversationPhase,
  ConversationResponseLevel,
  ConversationSpeechSpeed,
} from "./conversationTransportTypes";
import { logRealtime, warnRealtime } from "./conversationRealtimeSupport";
export function useRealtimeConversationTransport({
  sourceLanguage,
  targetLanguage,
  onError,
  onLoadingChange,
  onAssistantSpeakingChange,
  onPendingUserTurnChange,
  onConversationTurn,
  onPendingAssistantTextChange,
  conversationGoal,
  conversationPhase,
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
  const timerRef = useRef<number | null>(null);
  const maxRecordingTimeoutRef = useRef<number | null>(null);
  const autoRestartAfterAssistantRef = useRef<boolean>(true);
  const activeSessionTokenRef = useRef<number>(0);
  const baseInstructionsRef = useRef<string>("");
  const timedOutSubmissionRef = useRef<boolean>(false);
  const consecutiveTimeoutCountRef = useRef<number>(0);
  const realtimeUsage = useRealtimeActiveAudioUsage({
    onLimitReached: () => {
      setConversationPaused(true);
      onError("Your weekly live conversation minute limit has been reached. Please try again next week.");
      closeRealtimeSession();
    },
  });

  const sendRealtimeSessionUpdate = (
    speed: ConversationSpeechSpeed,
    level: ConversationResponseLevel,
    phase: ConversationPhase,
    transcriptionModel: string,
  ): void => {
    const dataChannel = dataChannelRef.current;
    if (!dataChannel || dataChannel.readyState !== "open") {
      return;
    }
    dataChannel.send(JSON.stringify(buildRealtimeSessionUpdate({
      baseInstructions: baseInstructionsRef.current,
      goal: conversationGoal,
      phase,
      speed,
      level,
      transcriptionModel,
    })));
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
    realtimeUsage.stopSession();
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
    sendRealtimeSessionUpdate(speechSpeed, responseLevel, conversationPhase, "gpt-4o-mini-transcribe");
  }, [conversationGoal, conversationPhase, conversationRealtimeReady, responseLevel, speechSpeed]);

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
    realtimeUsage.setAudioActive(true);
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
    realtimeUsage.setAudioActive(false);
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
          instructions: buildRealtimeInstructions({
            baseInstructions: baseInstructionsRef.current,
            goal: conversationGoal,
            phase: conversationPhase,
            speed: speechSpeed,
            level: responseLevel,
          }),
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

  const setupRealtimeConversation = (args: Parameters<typeof startRealtimeConversationSession>[0]["args"]): Promise<boolean> =>
    startRealtimeConversationSession({
      args, sourceLanguage, targetLanguage, conversationPhase, conversationGoal, speechSpeed, responseLevel,
      activeSessionTokenRef, baseInstructionsRef, streamRef: realtimeStreamRef, audioRef: realtimeAudioRef,
      peerConnectionRef, dataChannelRef, responseActiveRef: realtimeResponseActiveRef,
      pendingUserTextRef: realtimePendingUserTextRef, pendingAssistantTextRef: realtimePendingAssistantTextRef,
      completedTurnRef: realtimeCompletedTurnRef, audioStoppedRef: realtimeAudioStoppedRef, autoRestartAfterAssistantRef,
      closeSession: closeRealtimeSession, setConnecting: setConversationRealtimeConnecting,
      setReady: setConversationRealtimeReady, setVoice: setConversationRealtimeVoice,
      onUsageAllowance: realtimeUsage.startSession, onAudioActivityChange: realtimeUsage.setAudioActive,
      sendSessionUpdate: (transcriptionModel) => sendRealtimeSessionUpdate(speechSpeed, responseLevel, conversationPhase, transcriptionModel),
      onAssistantSpeakingChange, onPendingAssistantTextChange, onPendingUserTurnChange, onLoadingChange, onError,
      flushCompletedTurn, startRecording: () => void startRecording(false),
    });
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
