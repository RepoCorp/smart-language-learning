import type { WordExerciseGridPrimaryEntry, WordExerciseSelectableEntry } from "./WordExerciseGrid";
import WordExerciseGrid from "./WordExerciseGrid";

export const VERB_BY_TENSE_GENERATION_MODE = "verb_by_tense_v1";

export const VERB_TENSES = [
  { key: "present", label: "Present" },
  { key: "perfect", label: "Perfect" },
  { key: "simple-past", label: "Simple past" },
  { key: "future", label: "Future" },
] as const;

export const VERB_PERSONS = [
  { key: "1s", label: "1s" },
  { key: "2s", label: "2s" },
  { key: "3s", label: "3s" },
  { key: "1p", label: "1p" },
  { key: "2p", label: "2p" },
  { key: "3p", label: "3p" },
] as const;

export type VerbTenseKey = typeof VERB_TENSES[number]["key"];
export type VerbPersonKey = typeof VERB_PERSONS[number]["key"];

export interface ParsedVerbExerciseGridEntry {
  entry: WordExerciseSelectableEntry;
  parsed: {
    tense: VerbTenseKey;
    person: VerbPersonKey;
  };
}

export function parseVerbExerciseLabel(label: string): { tense: VerbTenseKey; person: VerbPersonKey } | null {
  const normalized = label.trim().toLowerCase().replace(/_/g, "-").replace(/\s+/g, "-");
  const personAliases: Record<string, VerbPersonKey> = {
    "1s": "1s",
    "first-singular": "1s",
    "1st-singular": "1s",
    "2s": "2s",
    "second-singular": "2s",
    "2nd-singular": "2s",
    "3s": "3s",
    "third-singular": "3s",
    "3rd-singular": "3s",
    "1p": "1p",
    "first-plural": "1p",
    "1st-plural": "1p",
    "2p": "2p",
    "second-plural": "2p",
    "2nd-plural": "2p",
    "3p": "3p",
    "third-plural": "3p",
    "3rd-plural": "3p",
  };
  const match = normalized.match(/^(present|perfect|simple-past|future)-(.+)$/);
  if (!match) {
    return null;
  }
  const person = personAliases[match[2]];
  if (!person) {
    return null;
  }
  return { tense: match[1] as VerbTenseKey, person };
}

export function buildVerbExerciseGridEntries(entries: WordExerciseSelectableEntry[]): ParsedVerbExerciseGridEntry[] {
  return entries
    .map((entry) => ({ entry, parsed: parseVerbExerciseLabel(entry.label || "") }))
    .filter((item): item is ParsedVerbExerciseGridEntry => Boolean(item.parsed));
}

export function getVerbExerciseKeysForPerson(
  gridEntries: ParsedVerbExerciseGridEntry[],
  exerciseEntryKey: (entry: WordExerciseSelectableEntry) => string,
  person: VerbPersonKey,
): string[] {
  return gridEntries
    .filter(({ parsed }) => parsed.person === person)
    .map(({ entry }) => exerciseEntryKey(entry));
}

export function getVerbExerciseKeysForTense(
  gridEntries: ParsedVerbExerciseGridEntry[],
  exerciseEntryKey: (entry: WordExerciseSelectableEntry) => string,
  tense: VerbTenseKey,
): string[] {
  return gridEntries
    .filter(({ parsed }) => parsed.tense === tense)
    .map(({ entry }) => exerciseEntryKey(entry));
}

interface VerbExerciseSelectorProps {
  ariaLabel: string;
  primaryEntry?: WordExerciseGridPrimaryEntry;
  gridEntries: ParsedVerbExerciseGridEntry[];
  selectedExerciseKeys: string[];
  exerciseRunning: boolean;
  exerciseEntryKey: (entry: WordExerciseSelectableEntry) => string;
  onToggleEntry: (entry: WordExerciseSelectableEntry) => void;
  onSelectPerson: (person: VerbPersonKey) => void;
  onSelectTense: (tense: VerbTenseKey) => void;
}

export default function VerbExerciseSelector({
  ariaLabel,
  primaryEntry,
  gridEntries,
  selectedExerciseKeys,
  exerciseRunning,
  exerciseEntryKey,
  onToggleEntry,
  onSelectPerson,
  onSelectTense,
}: VerbExerciseSelectorProps): JSX.Element {
  const entryBySlot = new Map(
    gridEntries.map(({ entry, parsed }) => [`${parsed.person}-${parsed.tense}`, entry]),
  );
  const selectedKeySet = new Set(selectedExerciseKeys);
  const isExactSelection = (keys: string[]): boolean => {
    if (keys.length === 0 || selectedExerciseKeys.length !== keys.length) {
      return false;
    }
    return keys.every((key) => selectedKeySet.has(key));
  };

  const columns = VERB_TENSES.map((tense) => {
    const keys = getVerbExerciseKeysForTense(gridEntries, exerciseEntryKey, tense.key);
    return {
      key: tense.key,
      label: tense.label,
      selected: isExactSelection(keys),
      onClick: () => (isExactSelection(keys) ? onSelectTense("__clear__" as VerbTenseKey) : onSelectTense(tense.key)),
      disabled: exerciseRunning || keys.length === 0,
    };
  });

  const rows = VERB_PERSONS.map((person) => {
    const rowKeys = getVerbExerciseKeysForPerson(gridEntries, exerciseEntryKey, person.key);
    return {
      key: person.key,
      label: person.label,
      selected: isExactSelection(rowKeys),
      onClick: () => (isExactSelection(rowKeys) ? onSelectPerson("__clear__" as VerbPersonKey) : onSelectPerson(person.key)),
      disabled: exerciseRunning || rowKeys.length === 0,
      cells: VERB_TENSES.map((tense) => {
        const entry = entryBySlot.get(`${person.key}-${tense.key}`);
        return {
          key: `${person.key}-${tense.key}`,
          entry,
          selected: entry ? selectedExerciseKeys.includes(exerciseEntryKey(entry)) : false,
          onClick: entry ? () => onToggleEntry(entry) : undefined,
          disabled: exerciseRunning,
          placeholder: "-",
        };
      }),
    };
  });

  return (
    <WordExerciseGrid
      ariaLabel={ariaLabel}
      primaryEntry={primaryEntry}
      rowHeaderWidth="22px"
      columns={columns}
      rows={rows}
    />
  );
}
