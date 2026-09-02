import type { ExercisePhrase, ItemExercisePhrases, SessionItem } from "../types";

type PhrasePair = {
  source: string;
  target: string;
};

function pairFromExercisePhrase(entry: ExercisePhrase | undefined): PhrasePair | null {
  if (!entry?.source_text?.trim() || !entry.target_text?.trim()) {
    return null;
  }
  return { source: entry.source_text, target: entry.target_text };
}

function pairsFromEntries(entries: ExercisePhrase[] | undefined): PhrasePair[] {
  return (entries || [])
    .map(pairFromExercisePhrase)
    .filter((entry): entry is PhrasePair => entry !== null);
}

function strategyPhrasePairs(exercisePhrases: ItemExercisePhrases | undefined): PhrasePair[] {
  if (!exercisePhrases) {
    return [];
  }

  const formSectionPairs = (exercisePhrases.sections || []).flatMap((section) => pairsFromEntries(section.phrases));
  const encounterPairs = (exercisePhrases.encounter_situations || [])
    .map((entry) => pairFromExercisePhrase(entry))
    .filter((entry): entry is PhrasePair => entry !== null);
  const comparePairs = (exercisePhrases.compare_strategy || [])
    .map((entry) => {
      if (!entry.target_example_text.trim() || !entry.target_translation_text.trim()) {
        return null;
      }
      return { source: entry.target_translation_text, target: entry.target_example_text };
    })
    .filter((entry): entry is PhrasePair => entry !== null);

  return [
    ...pairsFromEntries(exercisePhrases.phrases),
    ...pairsFromEntries(exercisePhrases.first_section),
    ...pairsFromEntries(exercisePhrases.second_section),
    ...formSectionPairs,
    ...pairsFromEntries(exercisePhrases.personalize_phrases),
    ...pairsFromEntries(exercisePhrases.practice_phrases),
    ...pairsFromEntries(exercisePhrases.funny_image_phrase ? [exercisePhrases.funny_image_phrase] : []),
    ...pairsFromEntries(exercisePhrases.visualize_phrase ? [exercisePhrases.visualize_phrase] : []),
    ...pairsFromEntries(exercisePhrases.act_exercise ? [exercisePhrases.act_exercise] : []),
    ...pairsFromEntries(exercisePhrases.walk_challenge ? [exercisePhrases.walk_challenge] : []),
    ...encounterPairs,
    ...comparePairs,
  ];
}

export function warmupContextPairForItem(
  item: SessionItem,
  blankTargetInPhrase: (phrase: string, targetText: string) => string,
): PhrasePair {
  const dialogPairs = [
    ...(item.related_dialogs || []).flatMap((dialog) => dialog.matched_turns.map((turn) => ({
      source: turn.source_text,
      target: turn.target_text,
    }))),
    ...(item.related_dialogs || []).flatMap((dialog) => dialog.turns.map((turn) => ({
      source: turn.source_text,
      target: turn.target_text,
    }))),
  ];
  const candidates = [...dialogPairs, ...strategyPhrasePairs(item.exercise_phrases)].filter(
    (candidate) => candidate.target.trim() && candidate.source.trim(),
  );

  return candidates.find((candidate) => blankTargetInPhrase(candidate.target, item.german_text)) || { target: "", source: "" };
}
