import type { MutableRefObject } from "react";

import { createTopicConversationRealtimeSession } from "../../api";
import type { ContentItemConversationResponse } from "../../types";
import { createRealtimeSessionEventHandler } from "./realtimeSessionEvents";
import { connectRealtimeWebRtc } from "./realtimeWebRtcConnection";
import type { BaseConversationTransportArgs, StartConversationTransportArgs } from "./conversationTransportTypes";
import { logRealtime, warnRealtime } from "./conversationRealtimeSupport";

type RealtimeSessionSetupOptions = {
  args: StartConversationTransportArgs;
  sourceLanguage: BaseConversationTransportArgs["sourceLanguage"];
  targetLanguage: BaseConversationTransportArgs["targetLanguage"];
  conversationPhase: BaseConversationTransportArgs["conversationPhase"];
  conversationGoal: string;
  speechSpeed: BaseConversationTransportArgs["speechSpeed"];
  responseLevel: BaseConversationTransportArgs["responseLevel"];
  activeSessionTokenRef: MutableRefObject<number>;
  baseInstructionsRef: MutableRefObject<string>;
  streamRef: MutableRefObject<MediaStream | null>;
  audioRef: MutableRefObject<HTMLAudioElement | null>;
  peerConnectionRef: MutableRefObject<RTCPeerConnection | null>;
  dataChannelRef: MutableRefObject<RTCDataChannel | null>;
  responseActiveRef: MutableRefObject<boolean>;
  pendingUserTextRef: MutableRefObject<string>;
  pendingAssistantTextRef: MutableRefObject<string>;
  completedTurnRef: MutableRefObject<ContentItemConversationResponse | null>;
  audioStoppedRef: MutableRefObject<boolean>;
  autoRestartAfterAssistantRef: MutableRefObject<boolean>;
  closeSession: () => void;
  setConnecting: (connecting: boolean) => void;
  setReady: (ready: boolean) => void;
  setVoice: (voice: string) => void;
  sendSessionUpdate: (transcriptionModel: string) => void;
  onUsageAllowance: (remainingSeconds: number) => void;
  onAudioActivityChange: (active: boolean) => void;
  onAssistantSpeakingChange: BaseConversationTransportArgs["onAssistantSpeakingChange"];
  onPendingAssistantTextChange: BaseConversationTransportArgs["onPendingAssistantTextChange"];
  onPendingUserTurnChange: BaseConversationTransportArgs["onPendingUserTurnChange"];
  onLoadingChange: BaseConversationTransportArgs["onLoadingChange"];
  onError: BaseConversationTransportArgs["onError"];
  flushCompletedTurn: () => void;
  startRecording: () => void;
};

export async function startRealtimeConversationSession(options: RealtimeSessionSetupOptions): Promise<boolean> {
  const { args, sourceLanguage, targetLanguage, conversationPhase, conversationGoal, speechSpeed, responseLevel } = options;
  if (typeof window === "undefined" || typeof RTCPeerConnection === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    warnRealtime("unsupported");
    return false;
  }
  const startedAt = performance.now();
  options.setConnecting(true);
  const sessionToken = options.activeSessionTokenRef.current + 1;
  try {
    logRealtime("setup-started", { topic: args.topic, sourceLanguage, targetLanguage, goalDifficulty: args.goalDifficulty });
    const session = await createTopicConversationRealtimeSession(
      args.topic, args.notes, args.roleText, args.goalDifficulty, args.goalText,
      conversationPhase, sourceLanguage, targetLanguage,
    );
    const sessionRequestMs = Math.round(performance.now() - startedAt);
    options.baseInstructionsRef.current = (session.instructions || "").trim();
    logRealtime("session-request-finished", { elapsedMs: sessionRequestMs });
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
    options.closeSession();
    options.onUsageAllowance(Math.max(0, Number((session as { realtime_remaining_seconds?: number }).realtime_remaining_seconds || 0)));
    options.activeSessionTokenRef.current = sessionToken;
    const isSessionActive = (): boolean => options.activeSessionTokenRef.current === sessionToken;
    const connectionMetrics = await connectRealtimeWebRtc({
      ephemeralKey,
      isSessionActive,
      onResourcesReady: ({ peerConnection, dataChannel, mediaStream, remoteAudio }) => {
        options.peerConnectionRef.current = peerConnection;
        options.dataChannelRef.current = dataChannel;
        options.streamRef.current = mediaStream;
        options.audioRef.current = remoteAudio;
      },
      onDataChannelOpen: () => {
        logRealtime("data-channel-open");
        options.sendSessionUpdate(session.transcription_model || "gpt-4o-mini-transcribe");
        options.setReady(true);
        options.setVoice(session.voice || "");
        logRealtime("setup-timing-summary", {
          totalElapsedMs: Math.round(performance.now() - startedAt), sessionRequestMs,
        });
      },
      onDataChannelMessage: createRealtimeSessionEventHandler({
        isSessionActive,
        responseActiveRef: options.responseActiveRef,
        pendingUserTextRef: options.pendingUserTextRef,
        pendingAssistantTextRef: options.pendingAssistantTextRef,
        completedTurnRef: options.completedTurnRef,
        audioStoppedRef: options.audioStoppedRef,
        autoRestartAfterAssistantRef: options.autoRestartAfterAssistantRef,
        onAssistantSpeakingChange: options.onAssistantSpeakingChange,
        onAudioActivityChange: options.onAudioActivityChange,
        onPendingAssistantTextChange: options.onPendingAssistantTextChange,
        onPendingUserTurnChange: options.onPendingUserTurnChange,
        onLoadingChange: options.onLoadingChange,
        onError: options.onError,
        flushCompletedTurn: options.flushCompletedTurn,
        startRecording: options.startRecording,
      }),
      onNoAudioTrack: options.closeSession,
    });
    return Boolean(connectionMetrics);
  } finally {
    options.setConnecting(false);
  }
}
