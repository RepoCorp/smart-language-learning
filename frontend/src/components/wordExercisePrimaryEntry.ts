import type { WordExerciseGridPrimaryEntry, WordExerciseSelectableEntry } from "./WordExerciseGrid";

const PLURAL_LINE_PATTERN = /(?:^|\r?\n)\s*Plural:\s*([^\r\n]+)/i;
const PLURAL_INLINE_PATTERN = /\bPlural:\s*([^|]+?)(?=\s+[A-Z][a-z]+:|$)/i;

export function parsePluralFromNotes(notes: string): string {
  const normalizedNotes = String(notes || "").trim();
  if (!normalizedNotes) {
    return "";
  }
  const lineMatch = normalizedNotes.match(PLURAL_LINE_PATTERN);
  const inlineMatch = normalizedNotes.match(PLURAL_INLINE_PATTERN);
  const pluralValue = lineMatch?.[1] || inlineMatch?.[1] || "";
  return pluralValue.trim().replace(/[.;,\s]+$/g, "");
}

export function buildGermanPluralExerciseEntry(
  entry?: WordExerciseSelectableEntry,
  pluralGerman = "",
  notes = "",
): WordExerciseSelectableEntry | undefined {
  if (!entry) {
    return undefined;
  }

  const pluralTarget = String(pluralGerman || "").trim() || parsePluralFromNotes(notes);
  if (!pluralTarget) {
    return undefined;
  }

  return {
    ...entry,
    target: pluralTarget,
  };
}

interface BuildWordExercisePrimaryEntryArgs {
  entry?: WordExerciseSelectableEntry;
  pluralGerman?: string;
  notes?: string;
  selectedExerciseKeys: string[];
  exerciseRunning: boolean;
  exerciseEntryKey: (entry: WordExerciseSelectableEntry) => string;
  onToggleEntry: (entry: WordExerciseSelectableEntry) => void;
}

export function buildWordExercisePrimaryEntry({
  entry,
  pluralGerman = "",
  notes = "",
  selectedExerciseKeys,
  exerciseRunning,
  exerciseEntryKey,
  onToggleEntry,
}: BuildWordExercisePrimaryEntryArgs): WordExerciseGridPrimaryEntry | undefined {
  if (!entry) {
    return undefined;
  }

  const key = exerciseEntryKey(entry);
  const pluralText = String(pluralGerman || "").trim() || parsePluralFromNotes(notes);

  return {
    entry,
    selected: selectedExerciseKeys.includes(key),
    onClick: () => onToggleEntry(entry),
    disabled: exerciseRunning,
    detailText: pluralText ? `Plural: ${pluralText}` : "",
  };
}

export function buildGermanPluralPrimaryEntry({
  entry,
  pluralGerman = "",
  notes = "",
  selectedExerciseKeys,
  exerciseRunning,
  exerciseEntryKey,
  onToggleEntry,
}: BuildWordExercisePrimaryEntryArgs): WordExerciseGridPrimaryEntry | undefined {
  const pluralEntry = buildGermanPluralExerciseEntry(entry, pluralGerman, notes);
  if (!pluralEntry) {
    return undefined;
  }
  const key = exerciseEntryKey(pluralEntry);

  return {
    entry: pluralEntry,
    selected: selectedExerciseKeys.includes(key),
    onClick: () => onToggleEntry(pluralEntry),
    disabled: exerciseRunning,
    detailText: "Plural",
  };
}
