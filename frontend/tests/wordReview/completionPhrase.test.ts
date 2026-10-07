import { expect, it } from "vitest";
import { completionPhraseForItem, completionReplayAudio } from "../../src/components/wordReview/completionPhrase";
import type { DialogPhraseTurn, SessionItem } from "../../src/types";

const original = { target_text: "Ich stehe früh auf.", source_text: "Me levanto temprano.", phrase_audio_url: "/original.mp3" };
const exact = { target_text: "Wir wollen aufstehen.", source_text: "Queremos levantarnos.", phrase_audio_url: "/exact.mp3" };
const base: SessionItem = {
  id: 1, item_type: "word", german_text: "aufstehen", spanish_text: "levantarse", word_type: "verb",
  mode: "review", direction: "de_to_es", options: [], example_sentence: original.target_text,
};
function withTurns(turns: DialogPhraseTurn[]): SessionItem {
  return { ...base, related_dialogs: [{
    dialog_id: 1, topic: "Morning", context: "", audio_url: "", created_at: "2026-01-01", turns,
    matched_turns: turns.map((turn, turn_index) => ({ ...turn, turn_index, side: "target", match_score: 1 })),
  }] };
}

it("prefers an exact phrase even when the original has a different form", () => {
  expect(completionPhraseForItem(withTurns([original, exact]))).toEqual({
    text: exact.target_text, sourceText: exact.source_text, audioUrl: exact.phrase_audio_url,
  });
});

it("uses the original with its translation and audio when there is no exact phrase", () => {
  expect(completionPhraseForItem(withTurns([original]))).toEqual({
    text: original.target_text, sourceText: original.source_text, audioUrl: original.phrase_audio_url,
  });
});

it.each(["expression", " Expression "])("always uses the original for %s, even when another phrase matches exactly", word_type => {
  expect(completionPhraseForItem({ ...withTurns([exact, original]), word_type }).text).toBe(original.target_text);
});

it("uses the original for expressions containing ellipses and inflected words", () => {
  const phrase = { ...original, target_text: "Ich stelle mir vor, dass wir gewinnen." };
  const item = { ...withTurns([phrase]), german_text: "sich vorstellen, dass…", word_type: "expression", example_sentence: phrase.target_text };
  expect(completionPhraseForItem(item).text).toBe(phrase.target_text);
});

it.each([
  ["art", "The party starts."],
  ["schön", "Das ist schon fertig."],
  ["der Hund", "Der Hundertste kommt."],
  ["a", "Aardvarks sleep."],
])("does not treat partial or accent-insensitive matches as exact: %s", (german_text, target_text) => {
  const item = { ...withTurns([{ ...exact, target_text }, original]), german_text };
  expect(completionPhraseForItem(item).text).toBe(original.target_text);
});

it.each(["AUFSTEHEN!", "Wir müssen (aufstehen).", "Wir wollen aufstehen."])("matches the complete word with case and punctuation: %s", target_text => {
  expect(completionPhraseForItem(withTurns([{ ...exact, target_text }, original])).text).toBe(target_text);
});

it.each(["phrases", "first_section", "second_section", "personalize_phrases", "practice_phrases"] as const)("searches saved %s before using a nonmatching original", key => {
  const item = { ...withTurns([original]), exercise_phrases: {
    [key]: [{ target_text: exact.target_text, source_text: exact.source_text, audio_url: "/strategy.mp3" }],
  } };
  expect(completionPhraseForItem(item)).toEqual({ text: exact.target_text, sourceText: exact.source_text, audioUrl: "/strategy.mp3" });
});

it("retains the original text if its dialog is unavailable, without borrowing another phrase's audio", () => {
  const selected = completionPhraseForItem({ ...withTurns([exact]), word_type: "expression" });
  expect(selected).toEqual({ text: original.target_text, sourceText: "", audioUrl: "" });
  expect(completionReplayAudio("/word.mp3", selected)).toBe("");
});

it("does not choose a random linked turn if no original or exact phrase is available", () => {
  expect(completionPhraseForItem({ ...withTurns([original]), example_sentence: "" })).toEqual({ text: "", sourceText: "", audioUrl: "" });
});

it("does not assign audio from a different turn when the stored index no longer matches", () => {
  const item = withTurns([exact]);
  item.word_type = "expression";
  item.related_dialogs![0].matched_turns = [{ ...original, side: "target", turn_index: 0, match_score: 1 }];
  expect(completionPhraseForItem(item)).toEqual({ text: original.target_text, sourceText: original.source_text, audioUrl: "" });
});

it("keeps word-only replay when no phrase exists", () => {
  expect(completionReplayAudio("/word.mp3", { text: "", sourceText: "", audioUrl: "" })).toBe("/word.mp3");
});
