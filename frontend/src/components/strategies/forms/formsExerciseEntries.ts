import type { CompareWordRecord, ItemExercisePhrases, ItemType } from "../../../types";
import type { FormsExerciseEntry } from "./nounFormsTypes";

const MAX_EXERCISE_ENTRIES = 30;
type LabeledFormsExerciseEntry = FormsExerciseEntry & { label: string };

function sanitizeExerciseEntries(
  entries?: Array<{ label?: string; source_text?: string; target_text?: string }>,
): LabeledFormsExerciseEntry[] {
  if (!entries || !entries.length) {
    return [];
  }
  return entries
    .map((entry) => ({
      label: String(entry.label || "").trim(),
      source: String(entry.source_text || "").trim(),
      target: String(entry.target_text || "").trim(),
    }))
    .filter((entry) => entry.source && entry.target)
    .slice(0, MAX_EXERCISE_ENTRIES);
}

function generatedExerciseEntries(exercisePhrases?: ItemExercisePhrases): LabeledFormsExerciseEntry[] {
  const savedEntries = sanitizeExerciseEntries(exercisePhrases?.phrases);
  const legacyEntries = [
    ...sanitizeExerciseEntries(exercisePhrases?.first_section),
    ...sanitizeExerciseEntries(exercisePhrases?.second_section),
  ];
  return savedEntries.length ? savedEntries : legacyEntries;
}

export function buildFormsExerciseEntries({
  itemType,
  sourceText,
  targetText,
  exercisePhrases,
}: {
  itemType: ItemType;
  sourceText: string;
  targetText: string;
  exercisePhrases?: ItemExercisePhrases;
}) {
  const generatedWordExerciseEntries = generatedExerciseEntries(exercisePhrases);
  const funnyImageExerciseEntry = exercisePhrases?.funny_image_phrase;
  const funnyImageExerciseSelectionEntry =
    funnyImageExerciseEntry?.source_text && funnyImageExerciseEntry?.target_text
      ? {
          label: funnyImageExerciseEntry.label || "funny image",
          source: funnyImageExerciseEntry.source_text,
          target: funnyImageExerciseEntry.target_text,
        }
      : undefined;
  const regularWordExerciseEntries = itemType === "word"
    ? [{ label: "word", source: sourceText, target: targetText }, ...generatedWordExerciseEntries]
    : generatedWordExerciseEntries;
  const wordExerciseEntries = itemType === "word"
    ? [
        ...regularWordExerciseEntries,
        ...(funnyImageExerciseSelectionEntry ? [funnyImageExerciseSelectionEntry] : []),
      ]
    : regularWordExerciseEntries;

  return {
    generatedWordExerciseEntries,
    funnyImageExerciseEntry,
    funnyImageExerciseSelectionEntry,
    wordExerciseEntries,
  };
}

export function compareWordExerciseEntries(
  word: CompareWordRecord,
  exercisePhrasePayload?: ItemExercisePhrases,
): LabeledFormsExerciseEntry[] {
  const wordLabel = word.german_text;
  const compareWordEntry = {
    label: wordLabel ? `${wordLabel} - word` : "word",
    source: word.spanish_text,
    target: word.german_text,
  };
  const compareGeneratedEntries = generatedExerciseEntries(exercisePhrasePayload);
  const compareFunnyImageEntry = exercisePhrasePayload?.funny_image_phrase;
  const compareFunnyImageSelectionEntry =
    compareFunnyImageEntry?.source_text && compareFunnyImageEntry?.target_text
      ? [{
          label: wordLabel
            ? `${wordLabel} - ${compareFunnyImageEntry.label || "funny image"}`
            : compareFunnyImageEntry.label || "funny image",
          source: compareFunnyImageEntry.source_text,
          target: compareFunnyImageEntry.target_text,
        }]
      : [];
  const labeledGeneratedEntries = compareGeneratedEntries.map((entry) => ({
    ...entry,
    label: wordLabel ? `${wordLabel} - ${entry.label}` : entry.label,
  }));
  return [compareWordEntry, ...labeledGeneratedEntries, ...compareFunnyImageSelectionEntry];
}
