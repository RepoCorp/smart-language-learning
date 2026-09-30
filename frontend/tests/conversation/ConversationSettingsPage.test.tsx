import { useState } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { I18nProvider } from "../../src/i18n";
import ConversationPage from "../../src/features/conversation/ConversationPage";
import type { BaseConversationTransportArgs } from "../../src/features/conversation/conversationTransportTypes";

const mocks = vi.hoisted(() => ({
  args: null as BaseConversationTransportArgs | null,
  evaluate: vi.fn(async () => ({ goal_achieved: false })),
  start: vi.fn(), pause: vi.fn(), close: vi.fn(), stop: vi.fn(),
  goal: vi.fn(async () => ({ goal_text: "Buy bread", topic: "Shopping" })),
  begin: vi.fn(async () => ({ topic: "Shopping", goal_text: "Buy bread" })),
}));
vi.mock("../../src/api", () => ({
  evaluateTopicConversationGoal: mocks.evaluate,
  fetchContentTopics: vi.fn(async () => ({ topics: ["Shopping"] })),
  regenerateTopicConversationGoal: mocks.goal, startTopicConversation: mocks.begin,
}));
vi.mock("../../src/components/NewItem", () => ({ default: () => null }));
vi.mock("../../src/features/conversation/useConversationScroll", () => ({ useConversationScroll: () => ({}) }));
vi.mock("../../src/features/conversation/useConversationReview", () => ({ useConversationReview: () => ({
  resetReview: vi.fn(), preparationReady: true,
  finishedTranscript: { dialog: { turns: [] } }, generatedReviewAnnotations: {},
}) }));
vi.mock("../../src/features/conversation/ConversationReviewSection", () => ({ default: () => <p>Finished transcript</p> }));
vi.mock("../../src/features/conversation/useConversationTransport", () => ({ useConversationTransport: (args: BaseConversationTransportArgs) => {
  mocks.args = args;
  const [paused, setPaused] = useState(false);
  const [mode, setMode] = useState("http");
  return { conversationTransport: mode, conversationPaused: paused,
    conversationRecording: !paused, conversationRecordingSeconds: 8,
    conversationRealtimeConnecting: false, conversationRealtimeReady: true,
    startRecording: mocks.start, stopRecording: mocks.stop, closeRealtimeSession: mocks.close,
    setupRealtimeConversation: async () => { setMode("realtime"); return true; },
    setConversationTransport: setMode, setPaused: (value: boolean) => { mocks.pause(value); setPaused(value); },
  };
} }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(() => vi.restoreAllMocks());

it.each(["Natural Voices", "Live"])("keeps settings and a guide-only goal in %s, without per-turn evaluation", async (mode) => {
  const user = userEvent.setup();
  render(<I18nProvider><ConversationPage /></I18nProvider>);
  const start = screen.getByRole("button", { name: "Start conversation" });
  expect(start).toBeDisabled();
  expect(screen.queryByText("Conversation setup")).not.toBeInTheDocument();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  await user.click(screen.getByText("More controls"));
  await user.click(screen.getByRole("radio", { name: "Absolute beginner" }));
  expect(screen.getByRole("radio", { name: "Super slow" })).toBeChecked();
  await user.click(screen.getByRole("radio", { name: "Slow" }));
  expect(mocks.pause).not.toHaveBeenCalled();
  expect(localStorage.getItem("conversation_response_level")).toBe("A0");
  expect(localStorage.getItem("conversation_speech_speed")).toBe("slow");

  await user.click(screen.getByRole("button", { name: /Conversation mode:/ }));
  expect(screen.getByText("More controls").closest("details")).not.toHaveAttribute("open");
  await user.click(screen.getByRole("radio", { name: mode }));
  await user.click(screen.getByRole("button", { name: "Generate goal" }));
  await waitFor(() => expect(start).toBeEnabled());
  expect(mocks.goal).toHaveBeenCalledWith(expect.any(String), "", "", "medium", "spanish", "german");
  await user.click(start);
  await screen.findByRole("button", { name: "End conversation" });
  await waitFor(() => expect(mocks.start).toHaveBeenCalled());
  expect(mocks.args).toMatchObject({ responseLevel: "A0", speechSpeed: "slow" });
  expect(screen.queryByRole("button", { name: /Conversation mode:/ })).not.toBeInTheDocument();
  expect(screen.getAllByText("More controls")).toHaveLength(1);
  await user.click(screen.getByText("More controls"));
  await waitFor(() => expect(mocks.pause).toHaveBeenCalledWith(true));
  expect(screen.getByRole("radio", { name: "Slow" })).toBeChecked();
  await user.click(screen.getByRole("radio", { name: "A1" }));
  expect(mocks.args?.responseLevel).toBe("A1");

  await act(async () => mocks.args!.onConversationTurn({ user_text: "Ich kaufe Brot.", assistant_text: "Hallo!", assistant_translation_text: "Hola!" } as Parameters<BaseConversationTransportArgs["onConversationTurn"]>[0]));
  expect(mocks.evaluate).not.toHaveBeenCalled();
  expect(mocks.args?.conversationGoal).toBe("Buy bread");
  expect(mocks.args?.conversationPhase).toBe("active");
  expect(screen.queryByText(/tips|Ask help|reveal/i)).not.toBeInTheDocument();
  expect(screen.queryByText("Hallo!")).not.toBeInTheDocument();
  mocks.goal.mockResolvedValueOnce({ goal_text: "Ask the price", topic: "Shopping" });
  await user.click(screen.getByRole("button", { name: "New goal" }));
  await screen.findByText("Ask the price");
  expect(mocks.args?.conversationGoal).toBe("Ask the price");
  expect(mocks.evaluate).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "End conversation" }));
  expect(screen.getByText("Finished transcript")).toBeVisible();
  expect(screen.queryByText("More controls")).not.toBeInTheDocument();
  expect(screen.queryByRole("radio")).not.toBeInTheDocument();
});

it("keeps settings disabled while a goal is being generated and does not permit starting without it", async () => {
  mocks.goal.mockImplementationOnce(() => new Promise(() => {}));
  render(<I18nProvider><ConversationPage /></I18nProvider>);
  await userEvent.click(screen.getByText("More controls"));
  await userEvent.click(screen.getByRole("button", { name: "Generate goal" }));
  expect(screen.getByRole("button", { name: "Start conversation" })).toBeDisabled();
  for (const radio of screen.getAllByRole("radio")) expect(radio).toBeDisabled();
  expect(mocks.begin).not.toHaveBeenCalled();
});
