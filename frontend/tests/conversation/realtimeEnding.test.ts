import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { realtimeEventsHarness, spokenResponse } from "./realtimeEventsHarness";

beforeEach(() => { vi.spyOn(console, "info").mockImplementation(() => {}); });
afterEach(() => vi.restoreAllMocks());

const tool = {
  type: "response.done", response: {
    id: "tool", status: "completed",
    output: [{ type: "function_call", name: "finish_conversation", call_id: "finish-1", arguments: "{}" }],
  },
};
const finalCreated = { type: "response.created", response: { id: "goodbye", metadata: { conversation_closing: "true" } } };
const finalStopped = { type: "output_audio_buffer.stopped", response_id: "goodbye" };

it.each([false, true])("ends only after the final reply and its playback finish (audio first: %s)", audioFirst => {
  const { send, options, turns } = realtimeEventsHarness();
  send(tool);
  expect(turns).toEqual([]);
  expect(options.closing.sendEvent).toHaveBeenNthCalledWith(1, {
    type: "conversation.item.create",
    item: { type: "function_call_output", call_id: "finish-1", output: '{"accepted":true}' },
  });
  expect(options.closing.sendEvent).toHaveBeenNthCalledWith(2, expect.objectContaining({
    type: "response.create", response: expect.objectContaining({
      tools: [], tool_choice: "none", output_modalities: ["audio"],
      metadata: { conversation_closing: "true" }, instructions: expect.stringContaining("Speak German, slowly"),
    }),
  }));
  send(finalCreated);
  send({ type: "output_audio_buffer.started", response_id: "goodbye" });
  send(audioFirst ? finalStopped : spokenResponse("goodbye", "Auf Wiedersehen!"));
  expect(options.closing.onFinished).not.toHaveBeenCalled();
  expect(options.startRecording).not.toHaveBeenCalled();
  send(audioFirst ? spokenResponse("goodbye", "Auf Wiedersehen!") : finalStopped);
  expect(turns).toEqual([expect.objectContaining({ user_text: "Danke!", assistant_text: "Auf Wiedersehen!" })]);
  expect(options.closing.onFinished).toHaveBeenCalledOnce();
  expect(options.flushCompletedTurn.mock.invocationCallOrder[0]).toBeLessThan(options.closing.onFinished.mock.invocationCallOrder[0]);
  expect(options.startRecording).not.toHaveBeenCalled();
  send(finalStopped);
  send(spokenResponse("goodbye", "Auf Wiedersehen!"));
  expect(turns).toHaveLength(1);
  expect(options.closing.onFinished).toHaveBeenCalledOnce();
});

it("does not use goodbye keywords as an ending signal", () => {
  const { send, options } = realtimeEventsHarness();
  send(spokenResponse("reply", "Auf Wiedersehen bedeutet goodbye."));
  send({ type: "output_audio_buffer.stopped", response_id: "reply" });
  expect(options.closing.onFinished).not.toHaveBeenCalled();
  expect(options.closing.sendEvent).not.toHaveBeenCalled();
  expect(options.startRecording).toHaveBeenCalledOnce();
});

it("acknowledges a tool call once and lets preceding speech drain before the final reply", () => {
  const { send, options, turns } = realtimeEventsHarness();
  send({ ...tool, response: { ...tool.response, output: [...tool.response.output, ...spokenResponse("tool").response.output] } });
  send(tool);
  expect(options.closing.sendEvent).toHaveBeenCalledTimes(1);
  send({ type: "output_audio_buffer.stopped", response_id: "unrelated" });
  expect(options.closing.sendEvent).toHaveBeenCalledTimes(1);
  send({ type: "output_audio_buffer.stopped", response_id: "tool" });
  expect(options.closing.sendEvent).toHaveBeenCalledTimes(2);
  expect(turns).toEqual([]);
  expect(options.startRecording).not.toHaveBeenCalled();
});

it("ignores unrelated and late playback events while waiting for the goodbye", () => {
  const { send, options, turns } = realtimeEventsHarness();
  send(tool);
  send(finalCreated);
  send({ type: "output_audio_buffer.stopped", response_id: "tool" });
  send(spokenResponse("old", "Another response"));
  send(spokenResponse("goodbye", "Tschüss!"));
  expect(options.closing.onFinished).not.toHaveBeenCalled();
  expect(turns).toEqual([]);
  send(finalStopped);
  expect(options.closing.onFinished).toHaveBeenCalledOnce();
  expect(turns[0].assistant_text).toBe("Tschüss!");
});

it.each(["cancelled", "failed", "incomplete"])("does not auto-end on a %s farewell", status => {
  const { send, options } = realtimeEventsHarness();
  send(tool);
  send(finalCreated);
  const response = spokenResponse("goodbye");
  send({ ...response, response: { ...response.response, status } });
  send(finalStopped);
  expect(options.closing.onFinished).not.toHaveBeenCalled();
  expect(options.startRecording).not.toHaveBeenCalled();
  expect(options.onError).toHaveBeenCalledWith("Could not finish the goodbye.");
  expect(options.onLoadingChange).toHaveBeenCalledWith(false);
});

it("does not treat cleared/interrupted audio as a completed goodbye", () => {
  const { send, options } = realtimeEventsHarness();
  send(tool);
  send(finalCreated);
  send(spokenResponse("goodbye"));
  send({ type: "output_audio_buffer.cleared", response_id: "goodbye" });
  send(finalStopped);
  expect(options.closing.onFinished).not.toHaveBeenCalled();
  expect(options.startRecording).not.toHaveBeenCalled();
});

it("keeps manual ending available when the final response has no spoken audio", () => {
  const { send, options } = realtimeEventsHarness();
  send(tool);
  send(finalCreated);
  send({ type: "response.done", response: { id: "goodbye", status: "completed", output: [] } });
  expect(options.closing.onFinished).not.toHaveBeenCalled();
  expect(options.onError).toHaveBeenCalledWith("Could not finish the goodbye.");
  expect(options.closing.onClosingChange).toHaveBeenLastCalledWith(false);
});

it("does not finish or request more audio after manual disconnect", () => {
  const { send, options } = realtimeEventsHarness();
  send(tool);
  send(finalCreated);
  options.isSessionActive.mockReturnValue(false);
  send(spokenResponse("goodbye"));
  send(finalStopped);
  expect(options.closing.onFinished).not.toHaveBeenCalled();
  expect(options.closing.sendEvent).toHaveBeenCalledTimes(2);
});

it("does not request a goodbye after preceding tool-response audio is interrupted", () => {
  const { send, options } = realtimeEventsHarness();
  send({ ...tool, response: { ...tool.response, output: [...tool.response.output, ...spokenResponse("tool").response.output] } });
  send({ type: "output_audio_buffer.cleared", response_id: "tool" });
  send({ type: "output_audio_buffer.stopped", response_id: "tool" });
  expect(options.closing.sendEvent).toHaveBeenCalledTimes(1);
  expect(options.closing.onFinished).not.toHaveBeenCalled();
  expect(options.closing.onClosingChange).toHaveBeenLastCalledWith(false);
  expect(options.onError).toHaveBeenCalledWith("Could not finish the goodbye.");
});

it("reports a send failure without finishing or restarting the microphone", () => {
  const { send, options } = realtimeEventsHarness();
  options.closing.sendEvent.mockImplementation(() => { throw new Error("Disconnected"); });
  send(tool);
  expect(options.closing.onFinished).not.toHaveBeenCalled();
  expect(options.startRecording).not.toHaveBeenCalled();
  expect(options.onLoadingChange).toHaveBeenCalledWith(false);
  expect(options.onError).toHaveBeenCalledWith("Could not finish the goodbye.");
});
