import type { ExercisePhraseSection, StudyLanguageCode } from "../../../types";

export type FormsExerciseEntry = {
  label?: string;
  source: string;
  target: string;
};

export type NounFormsStrategyContentProps = {
  targetText: string;
  sourceText: string;
  sourceLanguage: StudyLanguageCode;
  pluralText: string;
  notes: string;
  wordOnlyExerciseEntry?: FormsExerciseEntry;
  nounExerciseSections: ExercisePhraseSection[];
  selectedExerciseKeys: string[];
  exerciseRunning: boolean;
  generatingNounCaseKey?: "" | "nominative" | "accusative" | "dative" | "genitive";
  onToggleEntry: (entry: FormsExerciseEntry) => void;
  onSelectKeys: (keys: string[]) => void;
  onGenerateCase: (caseKey: "nominative" | "accusative" | "dative" | "genitive") => void;
  exerciseEntryKey: (entry: FormsExerciseEntry) => string;
};
