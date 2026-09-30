import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { I18nProvider } from "../../src/i18n";
import ConversationActiveControls from "../../src/features/conversation/ConversationActiveControls";

const status = {
  canSendResponse: true, conversationPaused: false, conversationRecording: true,
  conversationRecordingSeconds: 8, conversationLoading: false, conversationRealtimeConnecting: false,
  responseLevel: "A2" as const, speechSpeed: "normal" as const,
};
const controls = () => ({
  onEndConversation: vi.fn(), onPause: vi.fn(),
  onResponseLevelChange: vi.fn(), onSpeechSpeedChange: vi.fn(),
  onStartRecording: vi.fn(), onStopRecording: vi.fn(),
});

it("shows pause or start, never both, and sends/ends through the original actions", () => {
  const actions = controls();
  const view = render(<I18nProvider><ConversationActiveControls status={status} controls={actions} /></I18nProvider>);
  expect(screen.queryByRole("button", { name: "Start speaking" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Pause" }));
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  fireEvent.click(screen.getByRole("button", { name: "End conversation" }));
  expect(actions.onPause).toHaveBeenCalledOnce();
  expect(actions.onStopRecording).toHaveBeenCalledOnce();
  expect(actions.onEndConversation).toHaveBeenCalledOnce();
  view.rerender(<I18nProvider><ConversationActiveControls status={{ ...status, conversationPaused: true, conversationRecording: false }} controls={actions} /></I18nProvider>);
  expect(screen.queryByRole("button", { name: "Pause" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Start speaking" }));
  expect(actions.onStartRecording).toHaveBeenCalledOnce();
});

it("pauses when opening More controls and dispatches speed/level changes", () => {
  const actions = controls();
  render(<I18nProvider><ConversationActiveControls status={status} controls={actions} /></I18nProvider>);
  const details = screen.getByText("More controls").closest("details")!;
  details.open = true;
  fireEvent(details, new Event("toggle"));
  expect(actions.onPause).toHaveBeenCalled();
  fireEvent.click(screen.getByRole("radio", { name: "Absolute beginner" }));
  expect(actions.onResponseLevelChange).toHaveBeenCalledWith("A0");
  fireEvent.click(screen.getByRole("radio", { name: "Slow" }));
  expect(actions.onSpeechSpeedChange).toHaveBeenCalledWith("slow");
});

it.each(["conversationLoading", "conversationRealtimeConnecting"] as const)("locks secondary settings while %s", key => {
  render(<I18nProvider><ConversationActiveControls status={{ ...status, [key]: true }} controls={controls()} /></I18nProvider>);
  fireEvent.click(screen.getByText("More controls"));
  for (const option of screen.getAllByRole("radio")) expect(option).toBeDisabled();
});
