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
