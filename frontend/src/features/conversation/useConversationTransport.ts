import { useState } from "react";

import type { BaseConversationTransportArgs, StartConversationTransportArgs } from "./conversationTransportTypes";
import { useHttpConversationTransport } from "./useHttpConversationTransport";
import { useRealtimeConversationTransport } from "./useRealtimeConversationTransport";

export type { ConversationTransport, GoalDifficulty } from "./conversationTransportTypes";

export function useConversationTransport(args: BaseConversationTransportArgs) {
  const [conversationTransport, setConversationTransport] = useState<"http" | "realtime">("http");
  const httpTransport = useHttpConversationTransport(args);
  const realtimeTransport = useRealtimeConversationTransport(args);

  const setupRealtimeConversation = async (options: StartConversationTransportArgs): Promise<boolean> => {
    const enabled = await realtimeTransport.setupRealtimeConversation(options);
    if (enabled) {
      setConversationTransport("realtime");
    }
    return enabled;
  };

  const closeRealtimeSession = (): void => {
    realtimeTransport.closeRealtimeSession();
  };

  const startRecording = async (conversationLoading: boolean): Promise<void> => {
    if (conversationTransport === "realtime") {
      await realtimeTransport.startRecording(conversationLoading);
      return;
    }
    await httpTransport.startRecording(conversationLoading);
  };

  const stopRecording = (submit: boolean): void => {
    if (conversationTransport === "realtime") {
      realtimeTransport.stopRecording(submit);
      return;
    }
    httpTransport.stopRecording(submit);
  };

  return {
    conversationRecording: conversationTransport === "realtime"
      ? realtimeTransport.conversationRecording
      : httpTransport.conversationRecording,
    conversationRecordingSeconds: conversationTransport === "realtime"
      ? realtimeTransport.conversationRecordingSeconds
      : httpTransport.conversationRecordingSeconds,
    conversationTransport,
    conversationRealtimeConnecting: realtimeTransport.conversationRealtimeConnecting,
    conversationRealtimeReady: realtimeTransport.conversationRealtimeReady,
    conversationRealtimeVoice: realtimeTransport.conversationRealtimeVoice,
    closeRealtimeSession,
    setupRealtimeConversation,
    startRecording,
    stopRecording,
    setConversationTransport,
  };
}
