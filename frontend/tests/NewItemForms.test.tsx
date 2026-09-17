import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import NewItem from "../src/components/NewItem";
import { fetchContentItemDetail } from "../src/api";
import { generateContentItemExercises } from "../src/apiNounExercises";
import { useRepeatExerciseLoop } from "../src/components/useRepeatExerciseLoop";
import type { ExercisePhrase, SessionItem } from "../src/types";

vi.mock("../src/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../src/api")>(),
  fetchContentItemDetail: vi.fn(),
}));

vi.mock("../src/apiNounExercises", async (importOriginal) => ({
  ...await importOriginal<typeof import("../src/apiNounExercises")>(),
  generateContentItemExercises: vi.fn(),
}));

vi.mock("../src/components/useRepeatExerciseLoop", () => ({
  useRepeatExerciseLoop: vi.fn(),
}));

const startLoop = vi.fn();
const stopLoop = vi.fn();
const phrase = (target: string, source = `Translation: ${target}`, label = "example"): ExercisePhrase => ({
  target_text: target,
  source_text: source,
  label,
});

function word(overrides: Partial<SessionItem> = {}): SessionItem {
  return {
    id: 71,
    item_type: "word",
    mode: "new",
    word_type: "adjective",
    german_text: "klein",
    spanish_text: "pequeño",
    options: [],
    exercise_phrases: { phrases: [phrase("Das ist klein.")] },
    ...overrides,
  };
}

async function openForms(item: SessionItem) {
  vi.mocked(fetchContentItemDetail).mockResolvedValue({
    ...item,
    created_at: "2026-09-17T00:00:00Z",
  });
  const view = render(<NewItem item={item} readOnly />);
  await userEvent.click(screen.getByRole("button", { name: "Open strategies" }));
  const modal = within(await screen.findByRole("dialog"));
  await userEvent.selectOptions(modal.getByRole("combobox"), "Forms");
  return { ...view, modal };
}

function loopLines(): string[] {
  return vi.mocked(useRepeatExerciseLoop).mock.lastCall![0].defaultLines;
}

describe("item Forms entry preparation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRepeatExerciseLoop).mockReturnValue({
      secondsLeft: 30,
      isRunning: false,
      isMuted: false,
      start: startLoop,
      stop: stopLoop,
      toggleMute: vi.fn(),
    });
    vi.mocked(generateContentItemExercises).mockRejectedValue(new Error("Unexpected generation"));
  });

  it("prefers saved sentences, trims them, and sends only selected entries to the loop", async () => {
    const { modal } = await openForms(word({ exercise_phrases: {
      phrases: [phrase("  Das ist klein.  ", "  Eso es pequeño.  ", "  example  ")],
      first_section: [phrase("Legacy sentence.")],
    } }));

    expect(modal.queryByText("Legacy sentence.")).not.toBeInTheDocument();
    expect(modal.getByText("Eso es pequeño.")).toBeInTheDocument();
    expect(modal.getByRole("button", { name: "Start loop" })).toBeDisabled();
    expect(loopLines()).toEqual([]);

    const sentence = modal.getByRole("button", { name: "Das ist klein. Eso es pequeño." });
    await userEvent.click(sentence);
    expect(sentence).toHaveClass("exercise-phrase-row-selected");
    expect(loopLines()).toEqual(["Das ist klein."]);
    await userEvent.click(modal.getByRole("button", { name: "klein pequeño" }));
    expect(loopLines()).toEqual(["klein", "Das ist klein."]);
    await userEvent.click(sentence);
    expect(loopLines()).toEqual(["klein"]);
    await userEvent.click(modal.getByRole("button", { name: "Start loop" }));
    expect(startLoop).toHaveBeenCalledOnce();
    expect(generateContentItemExercises).not.toHaveBeenCalled();
  });

  it("uses both legacy sections when there are no valid saved sentences", async () => {
    const { modal } = await openForms(word({ exercise_phrases: {
      phrases: [phrase("Missing translation", "  "), phrase("", "Missing target")],
      first_section: [phrase("First legacy sentence."), phrase("Invalid legacy", "")],
      second_section: [phrase("Second legacy sentence.")],
    } }));
    expect(modal.queryByText("Missing translation")).not.toBeInTheDocument();
    expect(modal.queryByText("Invalid legacy")).not.toBeInTheDocument();
    await userEvent.click(modal.getByRole("button", { name: "Select all" }));
    expect(loopLines()).toEqual(["klein", "First legacy sentence.", "Second legacy sentence."]);
    expect(generateContentItemExercises).not.toHaveBeenCalled();
  });

  it("filters incomplete sentences before limiting saved entries to 30", async () => {
    const { modal } = await openForms(word({ exercise_phrases: {
      phrases: [phrase("Invalid", ""), ...Array.from({ length: 32 }, (_, i) => phrase(`Sentence ${i + 1}.`))],
    } }));
    expect(modal.getByText("Sentence 30.")).toBeInTheDocument();
    expect(modal.queryByText("Sentence 31.")).not.toBeInTheDocument();
    await userEvent.click(modal.getByRole("button", { name: "Select all" }));
    expect(loopLines()).toEqual(["klein", ...Array.from({ length: 30 }, (_, i) => `Sentence ${i + 1}.`)]);
  });

  it("includes the image sentence and comparison word sentences in loop order", async () => {
    const { modal } = await openForms(word({
      exercise_phrases: {
        phrases: [phrase("Das ist klein.")],
        funny_image_phrase: phrase("Der Elefant ist klein.", "El elefante es pequeño.", ""),
      },
      compare_words: [{
        id: 72, item_type: "word", german_text: "groß", spanish_text: "grande",
        exercise_phrases: {
          phrases: [phrase("Das ist groß.")],
          first_section: [phrase("Ignored comparison legacy.")],
          funny_image_phrase: phrase("Die Maus ist groß.", "El ratón es grande.", ""),
        },
      }, {
        id: 73, item_type: "word", german_text: "lang", spanish_text: "largo",
        exercise_phrases: {
          first_section: [phrase("Das ist lang.")],
          second_section: [phrase("Der Tag ist lang.")],
        },
      }],
    }));
    expect(modal.queryByText("Ignored comparison legacy.")).not.toBeInTheDocument();
    await userEvent.click(modal.getByRole("button", { name: "Select all" }));
    expect(loopLines()).toEqual([
      "klein", "Das ist klein.", "Der Elefant ist klein.",
      "groß", "Das ist groß.", "Die Maus ist groß.", "lang", "Das ist lang.", "Der Tag ist lang.",
    ]);
    await userEvent.click(modal.getByRole("button", { name: "Unselect all" }));
    expect(loopLines()).toEqual([]);
    expect(generateContentItemExercises).not.toHaveBeenCalled();
  });

  it("ignores incomplete image sentences on the item and comparison words", async () => {
    const { modal } = await openForms(word({
      exercise_phrases: { phrases: [phrase("Das ist klein.")], funny_image_phrase: phrase("Incomplete image", "") },
      compare_words: [{
        id: 72, item_type: "word", german_text: "groß", spanish_text: "grande",
        exercise_phrases: { phrases: [phrase("Das ist groß.")], funny_image_phrase: phrase("", "Incomplete image translation") },
      }],
    }));
    expect(modal.queryByText("Incomplete image")).not.toBeInTheDocument();
    await userEvent.click(modal.getByRole("button", { name: "Select all" }));
    expect(loopLines()).toEqual(["klein", "Das ist klein.", "groß", "Das ist groß."]);
  });

  it("keeps equal comparison sentences independently selectable", async () => {
    const shared = phrase("Das ist gut.", "Eso está bien.");
    const { modal } = await openForms(word({
      exercise_phrases: { phrases: [shared] },
      compare_words: [{
        id: 72, item_type: "word", german_text: "gut", spanish_text: "bueno",
        exercise_phrases: { phrases: [shared] },
      }],
    }));
    const sentences = modal.getAllByRole("button", { name: "Das ist gut. Eso está bien." });
    await userEvent.click(sentences[1]);
    expect(sentences[1]).toHaveClass("exercise-phrase-row-selected");
    expect(sentences[0]).not.toHaveClass("exercise-phrase-row-selected");
    expect(loopLines()).toEqual(["Das ist gut."]);
  });

  it("prepares verb grid sentences for person and tense selection", async () => {
    const { modal } = await openForms(word({
      word_type: "verb", german_text: "spielen", spanish_text: "jugar",
      exercise_phrases: { generation_mode: "verb_by_tense_v1", phrases: [
        phrase("Ich spiele.", "Yo juego.", "present-1s"),
        phrase("Du spielst.", "Tú juegas.", "present-2s"),
        phrase("Ich habe gespielt.", "Yo he jugado.", "perfect-1s"),
      ] },
    }));
    // Row selectors currently have no accessible names; the first row is first-person singular.
    await userEvent.click(modal.getAllByRole("button", { name: "" })[0]);
    expect(loopLines()).toEqual(["Ich spiele.", "Ich habe gespielt."]);
    await userEvent.click(modal.getByRole("button", { name: "Present" }));
    expect(loopLines()).toEqual(["Ich spiele.", "Du spielst."]);
    expect(generateContentItemExercises).not.toHaveBeenCalled();
  });

  it("keeps the noun plural separately selectable and includes it in the loop", async () => {
    const nounPhrase = phrase("Der Hund kommt.", "El perro viene.", "nominative-definite");
    const { modal } = await openForms(word({
      word_type: "noun", german_text: "der Hund", spanish_text: "el perro", plural_german: "die Hunde",
      exercise_phrases: {
        generation_mode: "noun_cases_german_v1",
        phrases: [nounPhrase],
        sections: [{ key: "nominative", phrases: [nounPhrase] }],
      },
    }));
    await userEvent.click(modal.getByRole("button", { name: "die Hunde Plural el perro" }));
    expect(loopLines()).toEqual(["die Hunde"]);
    await userEvent.click(modal.getByRole("button", { name: "Select all" }));
    expect(loopLines()).toEqual(["der Hund", "Der Hund kommt.", "die Hunde"]);
  });

  it("loops the original phrase rather than word-only or comparison entries", async () => {
    const { modal } = await openForms(word({
      item_type: "phrase", german_text: "Guten Morgen!", spanish_text: "¡Buenos días!",
      audio_url: "https://example.com/phrase.mp3",
      exercise_phrases: { funny_image_phrase: phrase("Unrelated image sentence.") },
      compare_words: [{ id: 72, item_type: "word", german_text: "groß", spanish_text: "grande" }],
    }));
    expect(modal.queryByText("Unrelated image sentence.")).not.toBeInTheDocument();
    expect(modal.queryByText("groß")).not.toBeInTheDocument();
    expect(loopLines()).toEqual(["Guten Morgen!"]);
    expect(vi.mocked(useRepeatExerciseLoop).mock.lastCall![0].audioSources).toEqual(["https://example.com/phrase.mp3"]);
    expect(modal.getByRole("button", { name: "Start loop" })).toBeEnabled();
    expect(generateContentItemExercises).not.toHaveBeenCalled();
  });

  it("reopening starts unselected and changing items replaces the prepared entries", async () => {
    const { rerender, modal } = await openForms(word());
    await userEvent.click(modal.getByRole("button", { name: "Select all" }));
    await userEvent.click(modal.getByRole("button", { name: "Close" }));
    expect(stopLoop).toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Open strategies" }));
    const reopened = within(await screen.findByRole("dialog"));
    await userEvent.selectOptions(reopened.getByRole("combobox"), "Forms");
    expect(loopLines()).toEqual([]);
    await userEvent.click(reopened.getByRole("button", { name: "Select all" }));

    rerender(<NewItem item={word({ id: 74, german_text: "neu", spanish_text: "nuevo", exercise_phrases: { phrases: [phrase("Das ist neu.")] } })} readOnly />);
    await waitFor(() => expect(loopLines()).toEqual([]));
    await userEvent.selectOptions(reopened.getByRole("combobox"), "Forms");
    expect(reopened.queryByText("Das ist klein.")).not.toBeInTheDocument();
    await userEvent.click(reopened.getByRole("button", { name: "Select all" }));
    expect(loopLines()).toEqual(["neu", "Das ist neu."]);
  });
});
