import { extractRealtimeText, type RealtimeServerEvent } from "../conversationRealtimeSupport";
import { finalGoodbyeRequest, FINISH_CONVERSATION_TOOL } from "./realtimeClosingProtocol";

export type RealtimeClosingOptions = {
  sendEvent: (event: object) => void;
  getInstructions: () => string;
  onClosingChange: (closing: boolean) => void;
  onFinished: () => void;
  failureMessage: string;
};

function hasAudio(event: RealtimeServerEvent): boolean {
  return (event.response?.output || []).some(item =>
    item.content?.some(part => part.type === "audio" || part.type === "output_audio"));
}

// One controller per connection. Completion requires both a successful final
// response and its matching drained-audio event, never an estimated duration.
export function createRealtimeConversationEnding(options: RealtimeClosingOptions & {
  beforeGoodbye: () => void;
  onFailure: (message: string) => void;
}) {
  let stage: "idle" | "tool_audio" | "goodbye" | "finished" = "idle";
  let toolResponseId = "";
  let finalResponseId = "";
  let finalDone = false;
  const stopped = new Set<string>();
  const ignoredResponses = new Set<string>();
  const acknowledgedCalls = new Set<string>();
  const pass = { skip: false, finish: false };
  const skip = { skip: true, finish: false };

  const fail = (): void => {
    if (finalResponseId) ignoredResponses.add(finalResponseId);
    stage = "idle";
    options.onClosingChange(false);
    options.onFailure(options.failureMessage);
  };

  const requestGoodbye = (): void => {
    stage = "goodbye";
    options.beforeGoodbye();
    options.sendEvent(finalGoodbyeRequest(options.getInstructions()));
  };

  return {
    isClosing: () => stage !== "idle",
    handle(event: RealtimeServerEvent): { skip: boolean; finish: boolean } {
      const id = event.response?.id || event.response_id || "";
      if (stage === "finished") return skip;
      if (event.type === "output_audio_buffer.stopped" && id) stopped.add(id);
      // A tool response can itself contain audio. Acknowledge the tool at once,
      // but do not generate the final reply until that preceding audio drains.
      if (stage === "tool_audio" && event.type === "output_audio_buffer.stopped" && id === toolResponseId) {
        try { requestGoodbye(); } catch { fail(); }
        return skip;
      }
      if (stage === "tool_audio" && event.type === "output_audio_buffer.cleared" && id === toolResponseId) {
        fail();
        return skip;
      }
      if (id && ignoredResponses.has(id)) return skip;

      if (event.type === "response.done") {
        const call = event.response?.output?.find(item => item.type === "function_call" && item.name === FINISH_CONVERSATION_TOOL.name);
        if (call) {
          if (call.call_id && acknowledgedCalls.has(call.call_id)) return skip;
          if (stage !== "idle") return skip;
          if (event.response?.status !== "completed" || !id || !call.call_id) {
            fail();
            return skip;
          }
          try {
            const args = JSON.parse(call.arguments || "");
            if (!args || Array.isArray(args) || typeof args !== "object" || Object.keys(args).length) throw new Error("Invalid closing arguments");
            acknowledgedCalls.add(call.call_id);
            ignoredResponses.add(id);
            toolResponseId = id;
            finalResponseId = "";
            finalDone = false;
            stage = "tool_audio";
            options.onClosingChange(true);
            options.sendEvent({ type: "conversation.item.create", item: {
              type: "function_call_output", call_id: call.call_id, output: JSON.stringify({ accepted: true }),
            } });
            if (!hasAudio(event) || stopped.has(id)) requestGoodbye();
          } catch { fail(); }
          return skip;
        }
      }

      if (stage === "idle") return pass;
      if (event.type === "error" || event.type === "invalid_request_error") {
        fail();
        return skip;
      }
      if (stage === "goodbye" && !finalResponseId && id && event.response?.metadata?.conversation_closing === "true") {
        finalResponseId = id;
      }
      if (id && id !== finalResponseId) return skip;
      if (event.type === "output_audio_buffer.cleared" && id === finalResponseId) {
        fail();
        return skip;
      }
      if (event.type === "response.done" && id === finalResponseId) {
        if (event.response?.status !== "completed" || !hasAudio(event) || !extractRealtimeText(event)) {
          fail();
          return skip;
        }
        finalDone = true;
      }
      if (finalResponseId && finalDone && stopped.has(finalResponseId)) {
        stage = "finished";
        return { skip: false, finish: true };
      }
      return pass;
    },
  };
}
