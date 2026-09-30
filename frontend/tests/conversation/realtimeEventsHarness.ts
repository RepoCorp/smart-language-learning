import { vi } from "vitest";
import type { ContentItemConversationResponse } from "../../src/types";
import { createRealtimeSessionEventHandler } from "../../src/features/conversation/realtimeSessionEvents";

export function realtimeEventsHarness() {
  const turns: ContentItemConversationResponse[] = [];
  const options = {
    isSessionActive: vi.fn(() => true),
    responseActiveRef: { current: false },
    pendingUserTextRef: { current: "Danke!" },
    pendingAssistantTextRef: { current: "" },
    completedTurnRef: { current: null as ContentItemConversationResponse | null },
    audioStoppedRef: { current: false },
    autoRestartAfterAssistantRef: { current: true },
    onAssistantSpeakingChange: vi.fn(), onAudioActivityChange: vi.fn(),
    onPendingAssistantTextChange: vi.fn(), onPendingUserTurnChange: vi.fn(),
    onLoadingChange: vi.fn(), onError: vi.fn(), startRecording: vi.fn(),
    closing: {
      sendEvent: vi.fn(), getInstructions: vi.fn(() => "Speak German, slowly, at A2 level."),
      onClosingChange: vi.fn(), onFinished: vi.fn(), failureMessage: "Could not finish the goodbye.",
    },
    flushCompletedTurn: vi.fn(() => {
      if (!options.completedTurnRef.current) return;
      turns.push(options.completedTurnRef.current);
      options.completedTurnRef.current = null;
      options.pendingUserTextRef.current = "";
      options.pendingAssistantTextRef.current = "";
      options.audioStoppedRef.current = false;
    }),
  };
  const handler = createRealtimeSessionEventHandler(options);
  const send = (event: unknown) => handler({ data: JSON.stringify(event) } as MessageEvent);
  return { options, handler, send, turns };
}

export function spokenResponse(id = "reply", text = "Gern!") {
  return {
    type: "response.done", response: {
      id, status: "completed", output: [{ type: "message", content: [{ type: "audio", transcript: text }] }],
    },
  };
}
