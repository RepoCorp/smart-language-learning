import type { MutableRefObject } from "react";

import type { ContentItemConversationResponse } from "../../types";
import { extractRealtimeText, logRealtime, type RealtimeServerEvent, warnRealtime } from "./conversationRealtimeSupport";
import { createRealtimeConversationEnding, type RealtimeClosingOptions } from "./ending/realtimeConversationEnding";

type RealtimeSessionEventOptions = {
  isSessionActive: () => boolean;
  responseActiveRef: MutableRefObject<boolean>;
  pendingUserTextRef: MutableRefObject<string>;
  pendingAssistantTextRef: MutableRefObject<string>;
  completedTurnRef: MutableRefObject<ContentItemConversationResponse | null>;
  audioStoppedRef: MutableRefObject<boolean>;
  autoRestartAfterAssistantRef: MutableRefObject<boolean>;
  onAssistantSpeakingChange: (speaking: boolean) => void;
  onAudioActivityChange: (active: boolean) => void;
  onPendingAssistantTextChange: (text: string) => void;
  onPendingUserTurnChange: (pending: boolean) => void;
  onLoadingChange: (loading: boolean) => void;
  onError: (message: string) => void;
  flushCompletedTurn: () => void;
  startRecording: () => void;
  closing?: RealtimeClosingOptions;
};

export function createRealtimeSessionEventHandler({
  isSessionActive,
  responseActiveRef,
  pendingUserTextRef,
  pendingAssistantTextRef,
  completedTurnRef,
  audioStoppedRef,
  autoRestartAfterAssistantRef,
  onAssistantSpeakingChange,
  onAudioActivityChange,
  onPendingAssistantTextChange,
  onPendingUserTurnChange,
  onLoadingChange,
  onError,
  flushCompletedTurn,
  startRecording,
  closing,
}: RealtimeSessionEventOptions): (messageEvent: MessageEvent) => void {
  const ending = closing && createRealtimeConversationEnding({
    ...closing,
    beforeGoodbye: () => {
      pendingAssistantTextRef.current = "";
      completedTurnRef.current = null;
      audioStoppedRef.current = false;
      onPendingAssistantTextChange("");
      onAssistantSpeakingChange(true);
      onLoadingChange(true);
    },
    onFailure: (message) => {
      completedTurnRef.current = null;
      responseActiveRef.current = false;
      onAssistantSpeakingChange(false);
      onPendingUserTurnChange(false);
      onLoadingChange(false);
      onError(message);
    },
  });
  const completePlayback = (finish: boolean): void => {
    if (!completedTurnRef.current || !audioStoppedRef.current) return;
    flushCompletedTurn();
    if (finish) closing?.onFinished();
    else if (!ending?.isClosing() && autoRestartAfterAssistantRef.current) startRecording();
  };
  return (messageEvent: MessageEvent): void => {
    if (!isSessionActive()) return;
    let event: RealtimeServerEvent;
    try {
      event = JSON.parse(messageEvent.data) as RealtimeServerEvent;
    } catch {
      warnRealtime("message-parse-failed");
      return;
    }
    const eventType = String(event.type || "");
    if (eventType) logRealtime("server-event", { type: eventType });
    if (eventType === "output_audio_buffer.stopped" || eventType === "output_audio_buffer.cleared") onAudioActivityChange(false);
    const closingAction = ending?.handle(event);
    if (closingAction?.skip) return;
    if (eventType === "response.created" || eventType === "output_audio_buffer.started") {
      responseActiveRef.current = true;
      if (eventType === "output_audio_buffer.started") onAudioActivityChange(true);
      onAssistantSpeakingChange(true);
    }
    if (eventType === "response.done" || eventType === "response.output_audio.done") {
      responseActiveRef.current = false;
    }
    if (eventType === "output_audio_buffer.stopped") {
      responseActiveRef.current = false;
      audioStoppedRef.current = true;
      onAssistantSpeakingChange(false);
      completePlayback(Boolean(closingAction?.finish));
      return;
    }
    if (eventType === "conversation.item.input_audio_transcription.completed" || eventType === "conversation.item.input_audio_transcription.done") {
      pendingUserTextRef.current = (typeof event.transcript === "string" ? event.transcript : typeof event.item?.content?.[0]?.transcript === "string" ? event.item.content[0].transcript : "").trim();
      return;
    }
    if (eventType === "response.output_audio_transcript.delta" && typeof event.delta === "string") {
      pendingAssistantTextRef.current += event.delta;
      onPendingAssistantTextChange(pendingAssistantTextRef.current);
      return;
    }
    if (eventType === "response.output_audio_transcript.done") {
      const assistantText = (typeof event.transcript === "string" ? event.transcript : "").trim();
      if (assistantText) {
        pendingAssistantTextRef.current = assistantText;
        onPendingAssistantTextChange(assistantText);
      }
      return;
    }
    if (eventType === "response.done") {
      completedTurnRef.current = {
        user_text: pendingUserTextRef.current.trim(),
        user_translation_text: "",
        user_corrected_text: "",
        user_corrected_translation_text: "",
        user_correction_explanation: "",
        user_is_grammatically_correct: true,
        user_makes_sense_in_context: true,
        user_needs_correction: false,
        assistant_text: extractRealtimeText(event) || pendingAssistantTextRef.current.trim(),
        assistant_translation_text: "",
        assistant_audio_url: "",
      };
      completePlayback(Boolean(closingAction?.finish));
      return;
    }
    if (eventType === "error" || eventType === "invalid_request_error") {
      onAssistantSpeakingChange(false);
      onPendingUserTurnChange(false);
      onLoadingChange(false);
      onError(event.error?.message || event.message || "Realtime conversation error");
    }
  };
}
