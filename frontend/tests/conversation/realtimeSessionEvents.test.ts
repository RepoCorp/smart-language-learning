import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { realtimeEventsHarness, spokenResponse } from "./realtimeEventsHarness";

beforeEach(() => { vi.spyOn(console, "info").mockImplementation(() => {}); });
afterEach(() => vi.restoreAllMocks());

it("keeps generation completion separate from playback completion", () => {
  const { send, options, turns } = realtimeEventsHarness();
  send({ type: "output_audio_buffer.started", response_id: "reply" });
  send(spokenResponse());
  expect(turns).toEqual([]);
  expect(options.startRecording).not.toHaveBeenCalled();
  send({ type: "output_audio_buffer.stopped", response_id: "reply" });
  expect(turns).toEqual([expect.objectContaining({ user_text: "Danke!", assistant_text: "Gern!" })]);
  expect(options.startRecording).toHaveBeenCalledTimes(1);
  expect(options.onAudioActivityChange).toHaveBeenLastCalledWith(false);
});

it("preserves the response when playback stops before the final response event", () => {
  const { send, turns, options } = realtimeEventsHarness();
  send({ type: "output_audio_buffer.stopped", response_id: "reply" });
  expect(options.startRecording).not.toHaveBeenCalled();
  send(spokenResponse());
  expect(turns).toHaveLength(1);
  expect(turns[0].assistant_text).toBe("Gern!");
  expect(options.startRecording).toHaveBeenCalledOnce();
});

it("does not restart recording when paused", () => {
  const { send, options, turns } = realtimeEventsHarness();
  options.autoRestartAfterAssistantRef.current = false;
  send(spokenResponse());
  send({ type: "output_audio_buffer.stopped", response_id: "reply" });
  expect(turns).toHaveLength(1);
  expect(options.startRecording).not.toHaveBeenCalled();
});

it("ignores events from a closed session", () => {
  const { send, options, turns } = realtimeEventsHarness();
  options.isSessionActive.mockReturnValue(false);
  send(spokenResponse());
  send({ type: "output_audio_buffer.stopped", response_id: "reply" });
  expect(turns).toEqual([]);
  expect(options.startRecording).not.toHaveBeenCalled();
});

it("keeps transcript updates and provider errors visible", () => {
  const { send, options } = realtimeEventsHarness();
  send({ type: "response.output_audio_transcript.delta", delta: "Gern" });
  expect(options.onPendingAssistantTextChange).toHaveBeenLastCalledWith("Gern");
  send({ type: "error", error: { message: "Connection failed" } });
  expect(options.onError).toHaveBeenCalledWith("Connection failed");
  expect(options.onLoadingChange).toHaveBeenCalledWith(false);
});
