import { describe, expect, it, vi } from "vitest";
import { warmupContextPairForItem } from "../src/components/wordWarmupContext";
import type { ItemExercisePhrases, SessionItem } from "../src/types";

const pair = { target_text: "Ich arbeite hier.", source_text: "Trabajo aquí." };
const item: SessionItem = {
  id: 1, item_type: "word", german_text: "arbeite", spanish_text: "trabajo",
  mode: "review", options: [],
};
// This module chooses candidates; the caller owns exact word matching.
const matcher = () => vi.fn((phrase: string, target: string) => (
  phrase === pair.target_text && target === item.german_text ? "Ich ____ hier." : ""
));
const strategies: Array<[string, ItemExercisePhrases]> = [
  ["forms", { phrases: [pair] }],
  ["legacy first", { first_section: [pair] }],
  ["legacy second", { second_section: [pair] }],
  ["form sections", { sections: [{ key: "present", phrases: [pair] }] }],
  ["create", { personalize_phrases: [pair] }],
  ["examples", { practice_phrases: [pair] }],
  ["funny image", { funny_image_phrase: pair }],
  ["visualize", { visualize_phrase: pair }],
  ["act", { act_exercise: { ...pair, actions: [] } }],
  ["walk", { walk_challenge: { ...pair, instruction: "Walk" } }],
  ["encounter", { encounter_situations: [{ ...pair, title: "Work", description: "At work" }] }],
  ["compare", { compare_strategy: [{
    target_text: "wirken", source_text: "actuar", difference_text: "Difference", mistake_text: "Mistake",
    target_example_text: pair.target_text, target_translation_text: pair.source_text,
    comparison_example_text: "Es wirkt.", comparison_translation_text: "Funciona.",
  }] }],
];

function dialog(source: string): NonNullable<SessionItem["related_dialogs"]>[number] {
  return { dialog_id: 1, topic: "Work", context: "", audio_url: "", created_at: "", matched_turns: [],
    turns: [{ ...pair, source_text: source }],
  };
}

describe("warm-up context selection", () => {
  it.each(strategies)("finds a translated matching phrase from %s", (_, exercise_phrases) => {
    const match = matcher();
    expect(warmupContextPairForItem({ ...item, exercise_phrases }, match))
      .toEqual({ target: pair.target_text, source: pair.source_text });
    expect(match).toHaveBeenCalledWith(pair.target_text, item.german_text);
  });

  it("prefers matched dialog turns, then other turns, then strategy phrases", () => {
    const related = dialog("Dialog translation");
    related.matched_turns = [{ ...pair, source_text: "Matched translation", turn_index: 0, side: "target", match_score: 1 }];
    const exercise = { ...item, related_dialogs: [related], exercise_phrases: { phrases: [pair] } };
    expect(warmupContextPairForItem(exercise, matcher()).source).toBe("Matched translation");
    related.matched_turns = [];
    expect(warmupContextPairForItem(exercise, matcher()).source).toBe("Dialog translation");
    related.turns = [];
    expect(warmupContextPairForItem(exercise, matcher()).source).toBe(pair.source_text);
  });

  it("ignores incomplete translations and asks the matcher about later candidates", () => {
    const match = matcher();
    const invalid = { target_text: "Nicht passend.", source_text: "No coincide." };
    expect(warmupContextPairForItem({ ...item, exercise_phrases: { phrases: [
      { ...pair, source_text: " " }, { ...pair, target_text: " " }, invalid, pair,
    ] } }, match)).toEqual({ target: pair.target_text, source: pair.source_text });
    expect(match.mock.calls).toEqual([[invalid.target_text, item.german_text], [pair.target_text, item.german_text]]);
  });

  it("keeps the target phrase paired with its own translation", () => {
    const related = dialog(" ");
    expect(warmupContextPairForItem({ ...item, related_dialogs: [related], exercise_phrases: { phrases: [pair] } }, matcher()))
      .toEqual({ target: pair.target_text, source: pair.source_text });
  });

  it("does not pick an unrelated phrase merely because content exists", () => {
    const reject = vi.fn(() => "");
    expect(warmupContextPairForItem({ ...item, related_dialogs: [dialog("Translation")] }, reject))
      .toEqual({ target: "", source: "" });
    expect(reject).toHaveBeenCalled();
    expect(warmupContextPairForItem(item, matcher())).toEqual({ target: "", source: "" });
  });

  it("skips an incomplete Compare example instead of using the comparison word's sentence", () => {
    const compare = strategies.find(([name]) => name === "compare")![1].compare_strategy![0];
    expect(warmupContextPairForItem({ ...item, exercise_phrases: {
      compare_strategy: [{ ...compare, target_translation_text: " " }],
    } }, matcher())).toEqual({ target: "", source: "" });
  });
});
