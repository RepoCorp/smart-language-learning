import { useEffect, useRef, useState } from "react";

import { sendTopicConversationAudio } from "../../api";
import {
  CONVERSATION_MAX_CONSECUTIVE_TIMEOUTS,
  CONVERSATION_MAX_RECORDING_MS,
} from "./conversationConstants";
import type { BaseConversationTransportArgs } from "./conversationTransportTypes";

const MIC_UNSUPPORTED = "Microphone recording is not supported on this device.";
const MIC_DENIED = "Microphone permission was denied.";
const AUDIO_FAILED = "Failed to process conversation audio";

export function useHttpConversationTransport({
  sourceLanguage,
  targetLanguage,
  onError,
  onLoadingChange,
  onAssistantSpeakingChange,
  onPendingUserTurnChange,
  onConversationTurn,
  onConversationGoalChange,
  playAudioUrl,
  conversationHistory,
  activeTopic,
  activeNotes,
  activeRole,
  conversationGoal,
}: BaseConversationTransportArgs) {
  const [conversationRecording, setConversationRecording] = useState<boolean>(false);
  const [conversationRecordingSeconds, setConversationRecordingSeconds] = useState<number>(0);
  const [conversationPaused, setConversationPaused] = useState<boolean>(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const shouldSubmitRef = useRef<boolean>(false);
  const timerRef = useRef<number | null>(null);
  const maxRecordingTimeoutRef = useRef<number | null>(null);
  const autoRestartAfterAssistantRef = useRef<boolean>(true);
  const timedOutSubmissionRef = useRef<boolean>(false);
  const consecutiveTimeoutCountRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        shouldSubmitRef.current = false;
        recorderRef.current.stop();
      }
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
      }
      if (maxRecordingTimeoutRef.current !== null) {
        window.clearTimeout(maxRecordingTimeoutRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

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

  const submitRecordedAudio = async (audioBlob: Blob): Promise<void> => {
    onLoadingChange(true);
    onPendingUserTurnChange(true);
    onError("");
    try {
      const response = await sendTopicConversationAudio(
        activeTopic,
        activeNotes,
        activeRole,
        conversationGoal,
        audioBlob,
        conversationHistory,
        sourceLanguage,
        targetLanguage,
      );
      onConversationTurn(response);
      onPendingUserTurnChange(false);
      if (response.goal_achieved && response.next_goal_suggestion) {
        onConversationGoalChange(response.next_goal_suggestion);
      }
      if (response.assistant_audio_url) {
        onAssistantSpeakingChange(true);
        const audio = new Audio(response.assistant_audio_url);
        audio.addEventListener("ended", () => {
          onAssistantSpeakingChange(false);
          if (autoRestartAfterAssistantRef.current) {
            void startRecording(false);
          }
        }, { once: true });
        void audio.play().catch(() => {
          onAssistantSpeakingChange(false);
          playAudioUrl(response.assistant_audio_url);
        });
      }
    } catch (error) {
      onPendingUserTurnChange(false);
      const detail = error instanceof Error ? error.message : "";
      onError(detail || AUDIO_FAILED);
    } finally {
      onLoadingChange(false);
    }
  };

  const stopRecording = (submit: boolean): void => {
    if (submit && !timedOutSubmissionRef.current) {
      consecutiveTimeoutCountRef.current = 0;
    }
    shouldSubmitRef.current = submit;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    clearTimer();
    if (!submit && streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (!submit) {
      setConversationRecording(false);
      setConversationRecordingSeconds(0);
    }
  };

  const startRecording = async (conversationLoading: boolean): Promise<void> => {
    if (conversationRecording || conversationLoading) {
      return;
    }
    setConversationPaused(false);
    autoRestartAfterAssistantRef.current = true;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      onError(MIC_UNSUPPORTED);
      return;
    }

    onError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorderOptions: MediaRecorderOptions = {};
      const preferredMimeTypes = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"];
      for (const mimeType of preferredMimeTypes) {
        if (typeof MediaRecorder.isTypeSupported === "function" && MediaRecorder.isTypeSupported(mimeType)) {
          recorderOptions.mimeType = mimeType;
          break;
        }
      }
      const recorder = new MediaRecorder(stream, recorderOptions);
      recorderRef.current = recorder;
      chunksRef.current = [];
      shouldSubmitRef.current = true;

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      });

      recorder.addEventListener("stop", () => {
        const shouldSubmit = shouldSubmitRef.current;
        clearTimer();
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
        setConversationRecording(false);
        setConversationRecordingSeconds(0);
        recorderRef.current = null;
        const recordedBlob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        chunksRef.current = [];
        if (timedOutSubmissionRef.current) {
          timedOutSubmissionRef.current = false;
          consecutiveTimeoutCountRef.current += 1;
          if (consecutiveTimeoutCountRef.current >= CONVERSATION_MAX_CONSECUTIVE_TIMEOUTS) {
            setPaused(true);
          }
        }
        if (shouldSubmit && recordedBlob.size > 0) {
          void submitRecordedAudio(recordedBlob);
        }
      });

      recorder.start();
      setConversationRecording(true);
      setConversationRecordingSeconds(0);
      timerRef.current = window.setInterval(() => {
        setConversationRecordingSeconds((value) => value + 1);
      }, 1000);
      maxRecordingTimeoutRef.current = window.setTimeout(() => {
        timedOutSubmissionRef.current = true;
        stopRecording(true);
      }, CONVERSATION_MAX_RECORDING_MS);
    } catch {
      onError(MIC_DENIED);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      recorderRef.current = null;
    }
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

  return {
    conversationPaused,
    conversationRecording,
    conversationRecordingSeconds,
    setPaused,
    startRecording,
    stopRecording,
  };
}
