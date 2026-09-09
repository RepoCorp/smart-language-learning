import { spanishNounGender } from "../../../languageFeatures/spanish/nouns";
import SpanishNounExerciseSelector from "../../SpanishNounExerciseSelector";
import { buildWordExercisePrimaryEntry } from "../../wordExercisePrimaryEntry";
import type { NounFormsStrategyContentProps } from "./nounFormsTypes";

export default function SpanishNounFormsStrategyContent({
  targetText,
  wordOnlyExerciseEntry,
  nounExerciseSections,
  selectedExerciseKeys,
  exerciseRunning,
  onToggleEntry,
  onSelectKeys,
  exerciseEntryKey,
}: NounFormsStrategyContentProps): JSX.Element {
  const primaryEntry = buildWordExercisePrimaryEntry({
    entry: wordOnlyExerciseEntry,
    selectedExerciseKeys,
    exerciseRunning,
    exerciseEntryKey,
    onToggleEntry,
  });

  return (
    <SpanishNounExerciseSelector
      primaryEntry={primaryEntry}
      sections={nounExerciseSections}
      selectedExerciseKeys={selectedExerciseKeys}
      exerciseRunning={exerciseRunning}
      exerciseEntryKey={exerciseEntryKey}
      onToggleEntry={onToggleEntry}
      onSelectKeys={onSelectKeys}
      gender={spanishNounGender(targetText)}
      targetText={targetText}
    />
  );
}
