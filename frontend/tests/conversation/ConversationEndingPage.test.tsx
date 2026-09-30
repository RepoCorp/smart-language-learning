import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ComponentProps, ReactNode } from "react";
import ConversationPage from "../../src/features/conversation/ConversationPage";
import type ConversationSetupCard from "../../src/features/conversation/ConversationSetupCard";
import type ConversationActiveControls from "../../src/features/conversation/ConversationActiveControls";
import type ConversationReviewSection from "../../src/features/conversation/ConversationReviewSection";
import type { BaseConversationTransportArgs } from "../../src/features/conversation/conversationTransportTypes";

const mocks = vi.hoisted(() => ({
  stop: vi.fn(), close: vi.fn(), start: vi.fn(), review: vi.fn(), resetReview: vi.fn(),
  transportArgs: null as BaseConversationTransportArgs | null,
}));
vi.mock("../../src/api", () => ({ startTopicConversation: vi.fn(async () => ({ topic: "Shopping", goal_text: "Buy bread" })) }));
vi.mock("../../src/i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("../../src/studyLanguages", () => ({ useStudyLanguages: () => ({ sourceLanguage: "spanish", targetLanguage: "german" }) }));
vi.mock("../../src/promptPreferences", () => ({ usePromptPreferences: () => ({ targetPromptMode: "audio" }) }));
vi.mock("../../src/components/NewItem", () => ({ default: () => null }));
vi.mock("../../src/features/conversation/useConversationSetup", () => ({ useConversationSetup: () => ({
  previousTopics: [], selectedTopic: "Shopping", notes: "", role: "", goalDifficulty: "easy",
  selectedConversationMode: "http", resolvedTopic: "Shopping", goal: { text: "Buy bread" },
}) }));
vi.mock("../../src/features/conversation/useConversationTransport", () => ({ useConversationTransport: (args: BaseConversationTransportArgs) => {
  mocks.transportArgs = args;
  return { conversationTransport: "http", stopRecording: mocks.stop, closeRealtimeSession: mocks.close,
    startRecording: mocks.start, setConversationTransport: vi.fn(), setPaused: vi.fn() };
} }));
vi.mock("../../src/features/conversation/useConversationReview", () => ({ useConversationReview: () => ({
  generateReview: mocks.review, resetReview: mocks.resetReview, preparationReady: true,
  finishedTranscript: { dialog: { turns: [] } }, generatedReviewAnnotations: {},
}) }));
vi.mock("../../src/features/conversation/useConversationScroll", () => ({ useConversationScroll: () => ({}) }));
vi.mock("../../src/features/conversation/ConversationSetupCard", () => ({ default: (props: ComponentProps<typeof ConversationSetupCard>) =>
  props.started ? null : <button onClick={props.onStart}>Start</button>,
}));
vi.mock("../../src/features/conversation/ConversationActiveControls", () => ({ default: (props: ComponentProps<typeof ConversationActiveControls> & { children?: ReactNode }) =>
  <button onClick={props.controls.onEndConversation}>End</button>,
}));
vi.mock("../../src/features/conversation/ConversationTurns", () => ({ default: () => null }));
vi.mock("../../src/features/conversation/ConversationReviewSection", () => ({ default: (props: ComponentProps<typeof ConversationReviewSection>) =>
  <section aria-label="Transcript"><button onClick={props.primaryAction?.onClick}>Generate review</button></section>,
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

async function startConversation() {
  render(<ConversationPage />);
  await act(async () => fireEvent.click(screen.getByText("Start")));
  await screen.findByText("End");
  await waitFor(() => expect(mocks.start).toHaveBeenCalled());
  mocks.resetReview.mockClear();
}

it("manual end stops recording and connection, then offers review without generating it", async () => {
  await startConversation();
  fireEvent.click(screen.getByText("End"));
  expect(window.confirm).toHaveBeenCalledOnce();
  expect(mocks.stop).toHaveBeenCalledWith(false);
  expect(mocks.close).toHaveBeenCalledOnce();
  expect(mocks.resetReview).toHaveBeenCalledOnce();
  expect(screen.getByRole("region", { name: "Transcript" })).toBeVisible();
  expect(screen.queryByText("End")).not.toBeInTheDocument();
  expect(mocks.review).not.toHaveBeenCalled();
});

it("declining the manual confirmation leaves the conversation running", async () => {
  await startConversation();
  vi.mocked(window.confirm).mockReturnValue(false);
  fireEvent.click(screen.getByText("End"));
  expect(mocks.stop).not.toHaveBeenCalled();
  expect(mocks.close).not.toHaveBeenCalled();
  expect(screen.queryByRole("region", { name: "Transcript" })).not.toBeInTheDocument();
});

it("automatic ending opens the same transcript without confirmation or automatic review", async () => {
  await startConversation();
  act(() => mocks.transportArgs!.onConversationFinished());
  expect(window.confirm).not.toHaveBeenCalled();
  expect(mocks.stop).toHaveBeenCalledWith(false);
  expect(mocks.close).toHaveBeenCalledOnce();
  expect(screen.getByRole("region", { name: "Transcript" })).toBeVisible();
  expect(mocks.review).not.toHaveBeenCalled();
});
