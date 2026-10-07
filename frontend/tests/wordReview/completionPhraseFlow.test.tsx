import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import WordReview from "../../src/components/WordReview";
import { PromptPreferencesProvider } from "../../src/promptPreferences";
import type { SessionItem } from "../../src/types";

vi.mock("../../src/components/InteractiveTargetPhrase", () => ({
  default: ({ targetText, sourceText }: { targetText: string; sourceText: string }) =>
    <div data-testid="completion-phrase" data-source={sourceText}>{targetText}</div>,
}));

const played: string[] = [];
beforeEach(() => {
  played.length = 0;
  localStorage.setItem("target_prompt_mode", "text");
  vi.stubGlobal("Audio", class extends EventTarget {
    src = "";
    currentTime = 0;
    onended: (() => void) | null = null;
    pause() {}
    load() {}
    play() {
      played.push(this.src);
      setTimeout(() => { this.dispatchEvent(new Event("ended")); this.onended?.(); }, 0);
      return Promise.resolve();
    }
  });
});
afterEach(() => vi.unstubAllGlobals());

const item: SessionItem = {
  id: 42, item_type: "word", word_type: "verb", german_text: "arbeiten", spanish_text: "trabajar",
  mode: "review", direction: "de_to_es", audio_url: "/word.mp3", options: [],
  related_dialogs: [{
    dialog_id: 1, topic: "Work", context: "", audio_url: "", created_at: "2026-01-01",
    turns: [{ target_text: "Wir arbeiten hier.", source_text: "Trabajamos aquí.", phrase_audio_url: "/phrase.mp3" }],
    matched_turns: [{ turn_index: 0, side: "target", match_score: 1, target_text: "Wir arbeiten hier.", source_text: "Trabajamos aquí." }],
  }],
};

function renderReview(value: SessionItem, onAnswered = vi.fn().mockResolvedValue(undefined)) {
  const view = render(<PromptPreferencesProvider><WordReview item={value} onAnswered={onAnswered} /></PromptPreferencesProvider>);
  return { ...view, onAnswered };
}

it.each(["Passed", "Failed"])("reveals the phrase only after %s, then plays word followed by phrase", async result => {
  const { onAnswered, rerender } = renderReview(item);
  expect(screen.queryByTestId("completion-phrase")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Reveal answer" }));
  expect(screen.queryByTestId("completion-phrase")).not.toBeInTheDocument();
  expect(played).toEqual([]);
  fireEvent.click(screen.getByRole("button", { name: result }));
  expect(screen.getByTestId("completion-phrase")).toHaveTextContent("Wir arbeiten hier.");
  expect(screen.getByTestId("completion-phrase")).toHaveAttribute("data-source", "Trabajamos aquí.");
  await waitFor(() => expect(onAnswered).toHaveBeenCalledWith(result === "Passed"));
  expect(played).toEqual(["/word.mp3", "/phrase.mp3"]);
  rerender(<PromptPreferencesProvider><WordReview item={item} onAnswered={onAnswered} reviewComplete /></PromptPreferencesProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Replay audio" }));
  await waitFor(() => expect(played).toEqual(["/word.mp3", "/phrase.mp3", "/phrase.mp3"]));
});

it("uses a saved strategy example when no dialog supplies a matching phrase", async () => {
  const value = { ...item, related_dialogs: [], exercise_phrases: {
    phrases: [{ target_text: "Wir arbeiten dort.", source_text: "Trabajamos allí.", audio_url: "/strategy.mp3" }],
  } };
  const { onAnswered } = renderReview(value);
  fireEvent.click(screen.getByRole("button", { name: "Reveal answer" }));
  fireEvent.click(screen.getByRole("button", { name: "Passed" }));
  expect(screen.getByTestId("completion-phrase")).toHaveTextContent("Wir arbeiten dort.");
  await waitFor(() => expect(onAnswered).toHaveBeenCalledWith(true));
  expect(played).toEqual(["/word.mp3", "/strategy.mp3"]);
});

it.each([
  ["es_to_de", true], ["es_to_de", false], ["de_to_es", true], ["de_to_es", false],
] as const)("uses the nonmatching original after scoring %s as %s", async (direction, correct) => {
  const value: SessionItem = { ...item, direction, german_text: "aufstehen", spanish_text: "levantarse",
    example_sentence: "Ich stehe früh auf.", related_dialogs: [{ ...item.related_dialogs![0],
      turns: [{ target_text: "Ich stehe früh auf.", source_text: "Me levanto temprano.", phrase_audio_url: "/original.mp3" }],
      matched_turns: [],
    }],
  };
  const { onAnswered } = renderReview(value);
  expect(screen.queryByTestId("completion-phrase")).not.toBeInTheDocument();
  if (direction === "de_to_es") {
    fireEvent.click(screen.getByRole("button", { name: "Reveal answer" }));
    expect(screen.queryByTestId("completion-phrase")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: correct ? "Passed" : "Failed" }));
  } else if (correct) {
    fireEvent.change(screen.getByTestId("word-input"), { target: { value: "aufstehen" } });
  } else {
    fireEvent.click(screen.getByRole("button", { name: "Fail" }));
  }
  expect(screen.getByTestId("completion-phrase")).toHaveTextContent("Ich stehe früh auf.");
  expect(screen.getByTestId("completion-phrase")).toHaveAttribute("data-source", "Me levanto temprano.");
  await waitFor(() => expect(onAnswered).toHaveBeenCalledWith(correct));
  expect(played).toEqual(["/word.mp3", "/original.mp3"]);
});

it("uses the original expression phrase even when another example exactly matches", async () => {
  const value: SessionItem = { ...item, word_type: "expression", example_sentence: "Ich arbeite hier.", related_dialogs: [{
    ...item.related_dialogs![0], turns: [...item.related_dialogs![0].turns,
      { target_text: "Ich arbeite hier.", source_text: "Trabajo aquí.", phrase_audio_url: "/original.mp3" }],
  }] };
  const { onAnswered } = renderReview(value);
  fireEvent.click(screen.getByRole("button", { name: "Reveal answer" }));
  fireEvent.click(screen.getByRole("button", { name: "Passed" }));
  expect(screen.getByTestId("completion-phrase")).toHaveTextContent("Ich arbeite hier.");
  await waitFor(() => expect(onAnswered).toHaveBeenCalledWith(true));
  expect(played).toEqual(["/word.mp3", "/original.mp3"]);
});

it("shows an original without saved phrase audio rather than replaying word audio for it", async () => {
  const value: SessionItem = { ...item, related_dialogs: [], example_sentence: "Ich arbeite hier." };
  const { onAnswered, rerender } = renderReview(value);
  fireEvent.click(screen.getByRole("button", { name: "Reveal answer" }));
  fireEvent.click(screen.getByRole("button", { name: "Passed" }));
  expect(screen.getByTestId("completion-phrase")).toHaveTextContent("Ich arbeite hier.");
  await waitFor(() => expect(onAnswered).toHaveBeenCalledWith(true));
  expect(played).toEqual(["/word.mp3"]);
  rerender(<PromptPreferencesProvider><WordReview item={value} onAnswered={onAnswered} reviewComplete /></PromptPreferencesProvider>);
  expect(screen.queryByRole("button", { name: "Replay audio" })).not.toBeInTheDocument();
});
