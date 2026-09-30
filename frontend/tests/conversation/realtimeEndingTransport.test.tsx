import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createTopicConversationRealtimeSession } from "../../src/api";
import { useRealtimeConversationTransport } from "../../src/features/conversation/useRealtimeConversationTransport";
import { connectRealtimeWebRtc } from "../../src/features/conversation/realtimeWebRtcConnection";
import type { BaseConversationTransportArgs } from "../../src/features/conversation/conversationTransportTypes";
import { spokenResponse } from "./realtimeEventsHarness";

vi.mock("../../src/api", () => ({ createTopicConversationRealtimeSession: vi.fn() }));
vi.mock("../../src/features/conversation/realtimeWebRtcConnection", () => ({ connectRealtimeWebRtc: vi.fn() }));
vi.mock("../../src/features/conversation/useRealtimeActiveAudioUsage", () => ({ useRealtimeActiveAudioUsage: () => ({
  startSession: vi.fn(), stopSession: vi.fn(), setAudioActive: vi.fn(),
}) }));

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.stubGlobal("RTCPeerConnection", vi.fn());
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn() } });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

async function setup() {
  let receive: (event: MessageEvent) => void = () => {};
  const send = vi.fn();
  const track = { enabled: false, stop: vi.fn() };
  const args: BaseConversationTransportArgs = {
    sourceLanguage: "spanish", targetLanguage: "german", activeTopic: "Shopping", activeNotes: "", activeRole: "",
    conversationGoal: "Buy bread", conversationPhase: "active", speechSpeed: "slow", responseLevel: "A2",
    conversationHistory: [], playAudioUrl: vi.fn(), onError: vi.fn(), onLoadingChange: vi.fn(),
    onAssistantSpeakingChange: vi.fn(), onPendingUserTurnChange: vi.fn(), onConversationTurn: vi.fn(),
    onPendingAssistantTextChange: vi.fn(), onConversationFinished: vi.fn(),
  };
  vi.mocked(createTopicConversationRealtimeSession).mockResolvedValue({
    realtime_enabled: true, client_secret: { value: "test-only" }, instructions: "Speak German.",
  } as Awaited<ReturnType<typeof createTopicConversationRealtimeSession>>);
  vi.mocked(connectRealtimeWebRtc).mockImplementation(async options => {
    receive = options.onDataChannelMessage;
    options.onResourcesReady({
      dataChannel: { readyState: "open", send, close: vi.fn() } as unknown as RTCDataChannel,
      peerConnection: { close: vi.fn() } as unknown as RTCPeerConnection,
      mediaStream: { getTracks: () => [track], getAudioTracks: () => [track] } as unknown as MediaStream,
      remoteAudio: { pause: vi.fn(), srcObject: null } as unknown as HTMLAudioElement,
    });
    options.onDataChannelOpen();
    return {} as NonNullable<Awaited<ReturnType<typeof connectRealtimeWebRtc>>>;
  });
  const hook = renderHook(props => useRealtimeConversationTransport(props), { initialProps: args });
  await act(async () => {
    await hook.result.current.setupRealtimeConversation({ topic: "Shopping", notes: "", roleText: "", goalDifficulty: "easy", goalText: "Buy bread" });
  });
  const emit = (event: unknown) => act(() => receive({ data: JSON.stringify(event) } as MessageEvent));
  const requestEnd = () => emit({ type: "response.done", response: {
    id: "tool", status: "completed", output: [{ type: "function_call", name: "finish_conversation", call_id: "end", arguments: "{}" }],
  } });
  return { hook, args, emit, requestEnd, send, track };
}

it("wires tool registration, latest settings, playback completion and current page callback", async () => {
  const { hook, args, emit, requestEnd, send, track } = await setup();
  expect(JSON.parse(send.mock.calls[0][0]).session.tools[0].name).toBe("finish_conversation");
  const finish = vi.fn();
  hook.rerender({ ...args, responseLevel: "A0", onConversationFinished: finish });
  emit({ type: "conversation.item.input_audio_transcription.completed", transcript: "Danke, tschüss!" });
  requestEnd();
  const finalRequest = send.mock.calls.map(([raw]) => JSON.parse(raw)).find(event => event.type === "response.create");
  expect(finalRequest.response.instructions).toContain("A0 absolute beginner");
  await act(async () => hook.result.current.startRecording(false));
  expect(track.enabled).toBe(false);
  emit({ type: "response.created", response: { id: "final", metadata: { conversation_closing: "true" } } });
  emit(spokenResponse("final", "Tschüss!"));
  expect(finish).not.toHaveBeenCalled();
  emit({ type: "output_audio_buffer.stopped", response_id: "final" });
  expect(finish).toHaveBeenCalledOnce();
  expect(args.onConversationFinished).not.toHaveBeenCalled();
  expect(args.onConversationTurn).toHaveBeenCalledWith(expect.objectContaining({ user_text: "Danke, tschüss!", assistant_text: "Tschüss!" }));
  expect(track.enabled).toBe(false);
});

it("disconnect prevents late automatic completion and releases audio resources", async () => {
  const { hook, args, emit, requestEnd, track } = await setup();
  requestEnd();
  act(() => hook.result.current.closeRealtimeSession());
  emit({ type: "response.created", response: { id: "final", metadata: { conversation_closing: "true" } } });
  emit(spokenResponse("final"));
  emit({ type: "output_audio_buffer.stopped", response_id: "final" });
  expect(args.onConversationFinished).not.toHaveBeenCalled();
  expect(track.stop).toHaveBeenCalled();
});
