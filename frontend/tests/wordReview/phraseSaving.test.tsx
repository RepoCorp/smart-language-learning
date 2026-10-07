import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import RevealedReviewSummary from "../../src/components/RevealedReviewSummary";
import InteractiveTargetPhrase from "../../src/components/InteractiveTargetPhrase";
import { fetchContentItemDetail, quickAddPhraseFromConversation } from "../../src/api";
import { I18nProvider } from "../../src/i18n";
import { useState } from "react";
import WordReview from "../../src/components/WordReview";
import { PromptPreferencesProvider } from "../../src/promptPreferences";
import type { SessionItem } from "../../src/types";

vi.mock("../../src/api", () => ({
  fetchContentItemDetail: vi.fn(),
  quickAddPhraseFromConversation: vi.fn(),
  quickAddWordFromDialog: vi.fn(),
}));
vi.mock("../../src/components/LegacyItemView", () => ({
  default: ({ onClose }: { onClose: () => void }) => <button onClick={onClose}>Close saved item</button>,
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(quickAddPhraseFromConversation).mockResolvedValue({ created: true, exists: false, id: 91 });
  vi.mocked(fetchContentItemDetail).mockResolvedValue({
    id: 91, item_type: "phrase", german_text: "Wir arbeiten hier.", spanish_text: "Trabajamos aquí.",
  } as Awaited<ReturnType<typeof fetchContentItemDetail>>);
});

const phrase = "Wir arbeiten hier.";
const translation = "Trabajamos aquí.";

it("keeps replay and text visibility independent and resets them for the next item", () => {
  const replay = vi.fn();
  const view = (itemId: number) => <RevealedReviewSummary itemId={itemId} answer="trabajar" phrase={phrase}
    phraseTranslation={translation} audioOnly onReplayAudio={replay} />;
  const { rerender } = render(view(1));
  expect(screen.queryByRole("button", { name: "Wir" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Replay audio" }));
  expect(replay).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Show text" }));
  expect(screen.getByRole("button", { name: "Wir" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Hide text" }));
  expect(screen.queryByRole("button", { name: "Wir" })).not.toBeInTheDocument();
  rerender(view(2));
  expect(screen.getByRole("button", { name: "Show text" })).toBeVisible();
});

it("leaves phrase saving disabled in other interactive text by default", () => {
  render(<InteractiveTargetPhrase targetText={phrase} sourceText={translation} statusKeyPrefix="other" />);
  expect(screen.queryByRole("button", { name: "Save a phrase" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Select expression" })).not.toBeInTheDocument();
});

function summary(sourceText = translation, audioOnly = false) {
  return <RevealedReviewSummary itemId={1} answer="trabajar" phrase={phrase}
    phraseTranslation={sourceText} audioOnly={audioOnly} onReplayAudio={vi.fn()} />;
}

it.each([translation, ""])("saves the complete post-test phrase with translation %s and returns to it", async sourceText => {
  render(summary(sourceText));
  fireEvent.click(screen.getByRole("button", { name: "Save a phrase" }));
  fireEvent.click(screen.getByRole("button", { name: /Full line/ }));
  expect(quickAddPhraseFromConversation).toHaveBeenCalledWith(
    sourceText, phrase, "spanish", "german", false, undefined, undefined, sourceText, phrase,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Close saved item" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Wir" })).toBeVisible();
  expect(quickAddPhraseFromConversation).toHaveBeenCalledOnce();
});

it("previews and saves only selected words with the complete phrase as context", async () => {
  vi.mocked(quickAddPhraseFromConversation).mockResolvedValueOnce({
    created: false, exists: false, source_text: "Trabajamos", target_text: "Wir arbeiten",
  });
  render(summary());
  fireEvent.click(screen.getByRole("button", { name: "Save a phrase" }));
  fireEvent.click(screen.getByRole("button", { name: /Short expression/ }));
  fireEvent.click(screen.getByRole("button", { name: "Wir" }));
  fireEvent.click(screen.getByRole("button", { name: "arbeiten" }));
  fireEvent.click(screen.getByRole("button", { name: "Add expression" }));
  expect(quickAddPhraseFromConversation).toHaveBeenNthCalledWith(1,
    "", "Wir arbeiten", "spanish", "german", true, undefined, undefined, translation, phrase,
  );
  const confirmation = await screen.findByRole("dialog");
  fireEvent.click(within(confirmation).getByRole("button", { name: "Add sentence" }));
  await screen.findByRole("button", { name: "Close saved item" });
  expect(quickAddPhraseFromConversation).toHaveBeenNthCalledWith(2,
    "Trabajamos", "Wir arbeiten", "spanish", "german", false, undefined, undefined, translation, phrase,
  );
  fireEvent.click(screen.getByRole("button", { name: "Close saved item" }));
  expect(screen.getByRole("button", { name: "Save a phrase" })).toBeVisible();
});

it("allows saving in audio-only mode without revealing the phrase", async () => {
  render(summary(translation, true));
  expect(screen.queryByRole("button", { name: "Wir" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Save sentence" }));
  fireEvent.click(await screen.findByRole("button", { name: "Close saved item" }));
  expect(screen.queryByRole("button", { name: "Wir" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Show text" })).toBeVisible();
});

it("keeps the saving overlay visible until details open, and permits retry on failure", async () => {
  let rejectSave!: (error: Error) => void;
  vi.mocked(quickAddPhraseFromConversation).mockImplementationOnce(() => new Promise((_, reject) => { rejectSave = reject; }));
  render(summary());
  fireEvent.click(screen.getByRole("button", { name: "Save a phrase" }));
  fireEvent.click(screen.getByRole("button", { name: /Full line/ }));
  expect(screen.getAllByRole("status")).toHaveLength(1);
  rejectSave(new Error("Quota exceeded"));
  expect(await screen.findByText("Quota exceeded")).toBeVisible();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Save a phrase" }));
  fireEvent.click(screen.getByRole("button", { name: /Full line/ }));
  await screen.findByRole("button", { name: "Close saved item" });
});

it("uses Guardar frase and Cancelar for the Spanish chooser", () => {
  localStorage.setItem("app_language", "es");
  render(<I18nProvider>{summary()}</I18nProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Guardar frase" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(screen.queryByRole("group")).not.toBeInTheDocument();
  expect(quickAddPhraseFromConversation).not.toHaveBeenCalled();
});

it("does not offer phrase saving when the answer only contains the word", () => {
  render(<RevealedReviewSummary itemId={1} answer="arbeiten" />);
  expect(screen.queryByRole("button", { name: "Save a phrase" })).not.toBeInTheDocument();
});

it("opens saved details from a scored word test without rescoring or advancing it", async () => {
  localStorage.setItem("target_prompt_mode", "text");
  const scored = vi.fn();
  const next = vi.fn().mockResolvedValue(undefined);
  const item: SessionItem = {
    id: 1, item_type: "word", german_text: "arbeiten", spanish_text: "trabajar",
    mode: "review", direction: "de_to_es", options: [],
    exercise_phrases: { phrases: [{ target_text: phrase, source_text: translation }] },
  };
  function Review() {
    const [completed, setCompleted] = useState(false);
    return <PromptPreferencesProvider><WordReview item={item} reviewComplete={completed}
      onAnswered={async correct => { scored(correct); setCompleted(true); }} onNextItem={next} /></PromptPreferencesProvider>;
  }
  render(<Review />);
  expect(screen.queryByRole("button", { name: "Save a phrase" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Reveal answer" }));
  expect(screen.queryByRole("button", { name: "Save a phrase" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Passed" }));
  await waitFor(() => expect(scored).toHaveBeenCalledOnce());
  fireEvent.click(screen.getByRole("button", { name: "Save a phrase" }));
  fireEvent.click(screen.getByRole("button", { name: /Full line/ }));
  fireEvent.click(await screen.findByRole("button", { name: "Close saved item" }));
  expect(scored).toHaveBeenCalledOnce();
  expect(scored).toHaveBeenCalledWith(true);
  expect(next).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(next).toHaveBeenCalledOnce();
});

it("resets saved status and selection when another post-test phrase is presented", async () => {
  const { rerender } = render(summary());
  fireEvent.click(screen.getByRole("button", { name: "Save a phrase" }));
  fireEvent.click(screen.getByRole("button", { name: /Short expression/ }));
  fireEvent.click(screen.getByRole("button", { name: "Wir" }));
  rerender(<RevealedReviewSummary itemId={2} answer="gehen" phrase="Wir gehen heute." phraseTranslation="Vamos hoy." />);
  expect(screen.queryByRole("button", { name: "Add expression" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Save a phrase" })).toBeVisible();
});
