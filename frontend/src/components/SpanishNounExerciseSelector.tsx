import type { ExercisePhraseSection } from "../types";
import { useI18n, type MessageKey } from "../i18n";
import WordExerciseGrid, {
  type WordExerciseGridPrimaryEntry,
  type WordExerciseSelectableEntry,
} from "./WordExerciseGrid";
import GenderedNounText, { type NounGender } from "./GenderedNounText";

interface SpanishNounExerciseSelectorProps {
  primaryEntry?: WordExerciseGridPrimaryEntry;
  sections: ExercisePhraseSection[];
  selectedExerciseKeys: string[];
  exerciseRunning: boolean;
  exerciseEntryKey: (entry: WordExerciseGridPrimaryEntry["entry"]) => string;
  onToggleEntry: (entry: WordExerciseGridPrimaryEntry["entry"]) => void;
  onSelectKeys: (keys: string[]) => void;
  gender: NounGender | null;
  targetText: string;
}

const FORM_ROWS = ["definite", "indefinite", "negative", "this", "that", "possessive"] as const;
const FORM_LABEL_KEYS: Record<(typeof FORM_ROWS)[number] | "singular" | "plural", MessageKey> = {
  singular: "strategies.forms.singular",
  plural: "strategies.forms.plural",
  definite: "strategies.forms.definite",
  indefinite: "strategies.forms.indefinite",
  negative: "strategies.forms.negative",
  this: "strategies.forms.this",
  that: "strategies.forms.that",
  possessive: "strategies.forms.possessive",
};

function sectionEntries(section: ExercisePhraseSection): WordExerciseSelectableEntry[] {
  return (section.phrases || [])
    .map((entry) => ({
      label: String(entry.label || "").trim(),
      source: String(entry.source_text || "").trim(),
      target: String(entry.target_text || "").trim(),
    }))
    .filter((entry) => entry.source && entry.target);
}

export default function SpanishNounExerciseSelector({
  primaryEntry,
  sections,
  selectedExerciseKeys,
  exerciseRunning,
  exerciseEntryKey,
  onToggleEntry,
  onSelectKeys,
  gender,
  targetText,
}: SpanishNounExerciseSelectorProps): JSX.Element {
  const { t } = useI18n();
  const entriesBySectionAndForm = new Map<string, WordExerciseSelectableEntry>();
  const selectedKeySet = new Set(selectedExerciseKeys);

  sections.forEach((section) => {
    sectionEntries(section).forEach((entry) => {
      if (entry.label) {
        entriesBySectionAndForm.set(`${section.key}:${entry.label.toLowerCase()}`, entry);
      }
    });
  });

  const keysForSection = (sectionKey: string): string[] => (
    FORM_ROWS
      .map((form) => entriesBySectionAndForm.get(`${sectionKey}:${form}`))
      .filter((entry): entry is WordExerciseSelectableEntry => Boolean(entry))
      .map((entry) => exerciseEntryKey(entry))
  );
  const keysForRow = (form: string): string[] => (
    sections
      .map((section) => entriesBySectionAndForm.get(`${section.key}:${form}`))
      .filter((entry): entry is WordExerciseSelectableEntry => Boolean(entry))
      .map((entry) => exerciseEntryKey(entry))
  );
  const isExactSelection = (keys: string[]): boolean => (
    keys.length > 0
    && selectedExerciseKeys.length === keys.length
    && keys.every((key) => selectedKeySet.has(key))
  );

  return (
    <WordExerciseGrid
      ariaLabel={t("strategies.forms.spanishTableLabel")}
      className="noun-exercise-selector spanish-noun-exercise-selector"
      columnMinWidth="210px"
      rowHeaderWidth="22px"
      primaryEntry={primaryEntry}
      targetClassName="noun-exercise-target-text"
      renderTargetText={(text) => (
        <GenderedNounText text={text} targetText={targetText} targetLanguage="spanish" gender={gender} />
      )}
      columns={sections.map((section) => {
        const keys = keysForSection(section.key);
        return {
          key: section.key,
          label: t(FORM_LABEL_KEYS[section.key as "singular" | "plural"] || "strategies.forms.singular"),
          selected: isExactSelection(keys),
          onClick: () => onSelectKeys(isExactSelection(keys) ? [] : keys),
          disabled: exerciseRunning || keys.length === 0,
        };
      })}
      rows={FORM_ROWS.map((form) => {
        const keys = keysForRow(form);
        return {
          key: form,
          label: t(FORM_LABEL_KEYS[form]),
          selected: isExactSelection(keys),
          onClick: () => onSelectKeys(isExactSelection(keys) ? [] : keys),
          disabled: exerciseRunning || keys.length === 0,
          cells: sections.map((section) => {
            const entry = entriesBySectionAndForm.get(`${section.key}:${form}`);
            const key = entry ? exerciseEntryKey(entry) : `${section.key}-${form}`;
            return {
              key,
              entry,
              selected: entry ? selectedExerciseKeys.includes(key) : false,
              onClick: entry ? () => onToggleEntry(entry) : undefined,
              disabled: exerciseRunning,
              placeholder: "-",
            };
          }),
        };
      })}
    />
  );
}
