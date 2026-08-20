import type { ExercisePhraseSection } from "../types";
import WordExerciseGrid, {
  type WordExerciseGridPrimaryEntry,
  type WordExerciseSelectableEntry,
} from "./WordExerciseGrid";

interface NounExerciseSelectorProps {
  primaryEntry?: WordExerciseGridPrimaryEntry;
  extraPrimaryEntries?: WordExerciseGridPrimaryEntry[];
  sections: ExercisePhraseSection[];
  selectedExerciseKeys: string[];
  exerciseRunning: boolean;
  generatingCaseKey?: string;
  allowCaseRegeneration?: boolean;
  exerciseEntryKey: (entry: WordExerciseGridPrimaryEntry["entry"]) => string;
  onToggleEntry: (entry: WordExerciseGridPrimaryEntry["entry"]) => void;
  onSelectKeys: (keys: string[]) => void;
  onGenerateCase: (caseKey: "nominative" | "accusative" | "dative" | "genitive") => void;
}

const DETERMINER_ROWS = [
  { key: "definite", label: "Definite" },
  { key: "indefinite", label: "Indefinite" },
  { key: "negative", label: "Negative (kein)" },
  { key: "possessive", label: "Possessive (mein)" },
  { key: "demonstrative", label: "Demonstrative (dieser)" },
] as const;

function sectionExerciseEntries(section: ExercisePhraseSection): WordExerciseSelectableEntry[] {
  return (section.phrases || [])
    .map((entry) => ({
      label: String(entry.label || "").trim(),
      source: String(entry.source_text || "").trim(),
      target: String(entry.target_text || "").trim(),
    }))
    .filter((entry) => entry.source && entry.target);
}

export default function NounExerciseSelector({
  primaryEntry,
  extraPrimaryEntries,
  sections,
  selectedExerciseKeys,
  exerciseRunning,
  generatingCaseKey,
  allowCaseRegeneration = true,
  exerciseEntryKey,
  onToggleEntry,
  onSelectKeys,
  onGenerateCase,
}: NounExerciseSelectorProps): JSX.Element {
  const entriesBySectionAndFamily = new Map<string, WordExerciseSelectableEntry>();
  const selectedKeySet = new Set(selectedExerciseKeys);

  sections.forEach((section) => {
    sectionExerciseEntries(section).forEach((entry) => {
      const familyKey = String(entry.label || "").trim().toLowerCase().split("-").pop() || "";
      if (familyKey) {
        entriesBySectionAndFamily.set(`${section.key}:${familyKey}`, entry);
      }
    });
  });

  const keysForSection = (sectionKey: string): string[] => (
    DETERMINER_ROWS
      .map((row) => entriesBySectionAndFamily.get(`${sectionKey}:${row.key}`))
      .filter((entry): entry is WordExerciseSelectableEntry => Boolean(entry))
      .map((entry) => exerciseEntryKey(entry))
  );

  const keysForRow = (rowKey: string): string[] => (
    sections
      .map((section) => entriesBySectionAndFamily.get(`${section.key}:${rowKey}`))
      .filter((entry): entry is WordExerciseSelectableEntry => Boolean(entry))
      .map((entry) => exerciseEntryKey(entry))
  );

  const isExactSelection = (keys: string[]): boolean => {
    if (keys.length === 0 || selectedExerciseKeys.length !== keys.length) {
      return false;
    }
    return keys.every((key) => selectedKeySet.has(key));
  };

  const selectRow = (rowKey: string): void => {
    const keys = keysForRow(rowKey);
    if (keys.length === 0) {
      return;
    }
    onSelectKeys(isExactSelection(keys) ? [] : keys);
  };

  const selectColumn = (sectionKey: string): void => {
    const keys = keysForSection(sectionKey);
    if (keys.length === 0) {
      if (allowCaseRegeneration && (sectionKey === "nominative" || sectionKey === "accusative" || sectionKey === "dative" || sectionKey === "genitive")) {
        onGenerateCase(sectionKey);
      }
      return;
    }
    onSelectKeys(isExactSelection(keys) ? [] : keys);
  };

  return (
    <WordExerciseGrid
      ariaLabel="Noun exercise grid"
      className="noun-exercise-selector"
      targetClassName="noun-exercise-target-text"
      columnMinWidth="180px"
      rowHeaderWidth="22px"
      primaryEntry={primaryEntry}
      extraPrimaryEntries={extraPrimaryEntries}
      columns={sections.map((section) => ({
        key: section.key,
        label: keysForSection(section.key).length === 0
          ? `+ ${section.question_target_text || section.key}`
          : (section.question_target_text || section.key),
        sublabel: section.question_source_text || "",
        selected: isExactSelection(keysForSection(section.key)),
        onClick: () => selectColumn(section.key),
        disabled: exerciseRunning || generatingCaseKey === section.key,
        secondaryActionLabel: allowCaseRegeneration && keysForSection(section.key).length > 0 ? "Regenerate case" : undefined,
        secondaryActionDisabled: generatingCaseKey === section.key || exerciseRunning,
        secondaryActionRequiresConfirm: allowCaseRegeneration && keysForSection(section.key).length > 0,
        onSecondaryActionClick: allowCaseRegeneration && keysForSection(section.key).length > 0 && (section.key === "nominative" || section.key === "accusative" || section.key === "dative" || section.key === "genitive")
          ? () => onGenerateCase(section.key)
          : undefined,
      }))}
      rows={DETERMINER_ROWS.map((row) => ({
        key: row.key,
        label: row.label,
        selected: isExactSelection(keysForRow(row.key)),
        onClick: () => selectRow(row.key),
        disabled: exerciseRunning || keysForRow(row.key).length === 0,
        cells: sections.map((section) => {
          const entry = entriesBySectionAndFamily.get(`${section.key}:${row.key}`);
          const key = entry ? exerciseEntryKey(entry) : `${section.key}-${row.key}`;
          return {
            key,
            entry,
            selected: entry ? selectedExerciseKeys.includes(key) : false,
            onClick: entry ? () => onToggleEntry(entry) : undefined,
            disabled: exerciseRunning,
            placeholder: "-",
          };
        }),
      }))}
    />
  );
}
