import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../src/i18n";
import ConversationActiveControls from "../src/features/conversation/ConversationActiveControls";
import DialogsFilterBar from "../src/features/dialogs/components/DialogsFilterBar";
import { buildRealtimeInstructions } from "../src/features/conversation/conversationRealtimeInstructions";
import { getInitialConversationResponseLevel, setStoredConversationResponseLevel } from "../src/features/conversation/conversationPreferences";

describe("absolute beginner conversation level", () => {
  it("remembers the selected level without changing the default", () => {
    localStorage.removeItem("conversation_response_level");
    expect(getInitialConversationResponseLevel()).toBe("A2");
    setStoredConversationResponseLevel("A0");
    expect(getInitialConversationResponseLevel()).toBe("A0");
  });

  it("includes beginner guidance in each live response without overriding goal or speed", () => {
    for (const phase of ["active", "closing"] as const) {
      const instructions = buildRealtimeInstructions({ baseInstructions: "Speak German", goal: "Buy bread", phase, speed: "super_slow", level: "A0" });
      expect(instructions).toContain("absolute beginner");
      expect(instructions).toContain("2 to 5 words");
      expect(instructions).toContain("yes/no");
      expect(instructions).toContain("Do not give goal-specific");
      expect(instructions).toContain("exceptionally slowly");
      if (phase === "closing") expect(instructions).toContain("Do not introduce a new subtopic or ask a new question");
    }
  });

  it.each(["en", "es"] as const)("offers localized conversation controls and dialog filters in %s", language => {
    localStorage.setItem("app_language", language);
    const onResponseLevelChange = vi.fn();
    const onLevelChange = vi.fn();
    const label = language === "en" ? "Absolute beginner" : "Principiante absoluto";
    render(<I18nProvider>
      <ConversationActiveControls status={{
        canSendResponse: false, conversationPaused: true, conversationRecording: false,
        conversationRecordingSeconds: 0, conversationLoading: false, conversationRealtimeConnecting: false,
        responseLevel: "A2", speechSpeed: "normal",
      }} controls={{
        onResponseLevelChange, onSpeechSpeedChange: vi.fn(), onEndConversation: vi.fn(),
        onPause: vi.fn(), onStartRecording: vi.fn(), onStopRecording: vi.fn(),
      }} />
      <DialogsFilterBar search="" topic="" context="" level="A0" topics={[]} contexts={[]} loading={false}
        onSearchChange={vi.fn()} onTopicChange={vi.fn()} onContextChange={vi.fn()} onLevelChange={onLevelChange} />
    </I18nProvider>);
    fireEvent.click(screen.getByText(language === "en" ? "More controls" : "Más controles"));
    const option = screen.getByRole("radio", { name: label });
    expect(option).not.toBeChecked();
    fireEvent.click(option);
    expect(onResponseLevelChange).toHaveBeenCalledWith("A0");
    const filter = screen.getByRole("option", { name: label });
    expect(filter).toHaveValue("A0");
    fireEvent.change(filter.closest("select")!, { target: { value: "A0" } });
    expect(onLevelChange).toHaveBeenCalledWith("A0");
  });
});
