import { useEffect, useState } from "react";

import { germanNounGender } from "../../../languageFeatures/german/nouns";
import type { NounGender } from "../../../languageFeatures/nouns";
import NounExerciseSelector from "../../NounExerciseSelector";
import { buildGermanPluralPrimaryEntry, buildWordExercisePrimaryEntry } from "../../wordExercisePrimaryEntry";
import { useI18n } from "../../../i18n";
import { germanNounFormsReferences } from "../germanNounFormsReferences";
import type { NounFormsStrategyContentProps } from "./nounFormsTypes";

const GENDERS: NounGender[] = ["masculine", "feminine", "neuter"];

export default function GermanNounFormsStrategyContent({
  targetText,
  sourceText,
  sourceLanguage,
  pluralText,
  notes,
  wordOnlyExerciseEntry,
  nounExerciseSections,
  selectedExerciseKeys,
  exerciseRunning,
  generatingNounCaseKey,
  onToggleEntry,
  onSelectKeys,
  onGenerateCase,
  exerciseEntryKey,
}: NounFormsStrategyContentProps): JSX.Element {
  const { t } = useI18n();
  const currentGender = germanNounGender(targetText);
  const comparisonReferences = germanNounFormsReferences(sourceLanguage);
  const [selectedGender, setSelectedGender] = useState<NounGender | null>(currentGender);
  const [comparisonExpanded, setComparisonExpanded] = useState(false);

  useEffect(() => {
    setSelectedGender(currentGender);
    setComparisonExpanded(false);
  }, [currentGender, targetText]);

  const selectedComparison = selectedGender && selectedGender !== currentGender
    ? comparisonReferences[selectedGender]
    : undefined;
  const displayedTargetText = selectedComparison?.targetText || targetText;
  const displayedSourceText = selectedComparison?.sourceText || sourceText;
  const displayedPluralText = selectedComparison?.pluralGerman || pluralText;
  const displayedSections = selectedComparison?.sections || nounExerciseSections;
  const displayedWordEntry = selectedComparison
    ? { source: displayedSourceText, target: displayedTargetText }
    : wordOnlyExerciseEntry;
  const displayedGender = germanNounGender(displayedTargetText);
  const primaryEntry = buildWordExercisePrimaryEntry({
    entry: displayedWordEntry,
    selectedExerciseKeys,
    exerciseRunning,
    exerciseEntryKey,
    onToggleEntry,
  });
  const genderMarkedPrimaryEntry = primaryEntry && displayedGender
    ? { ...primaryEntry, className: `gender-word-box gender-word-${displayedGender}` }
    : primaryEntry;
  const pluralPrimaryEntry = buildGermanPluralPrimaryEntry({
    entry: displayedWordEntry,
    pluralGerman: displayedPluralText,
    notes,
    selectedExerciseKeys,
    exerciseRunning,
    exerciseEntryKey,
    onToggleEntry,
  });

  return (
    <div className="noun-forms-table-content">
      <NounExerciseSelector
        primaryEntry={genderMarkedPrimaryEntry}
        extraPrimaryEntries={pluralPrimaryEntry ? [pluralPrimaryEntry] : []}
        sections={displayedSections}
        selectedExerciseKeys={selectedExerciseKeys}
        exerciseRunning={exerciseRunning}
        generatingCaseKey={generatingNounCaseKey || undefined}
        allowCaseRegeneration={!selectedComparison}
        exerciseEntryKey={exerciseEntryKey}
        onToggleEntry={onToggleEntry}
        onSelectKeys={onSelectKeys}
        onGenerateCase={onGenerateCase}
        gender={displayedGender}
        targetText={displayedTargetText}
        pluralText={displayedPluralText}
      />
      {currentGender && (
        <div className={`noun-forms-comparison ${comparisonExpanded ? "noun-forms-comparison-expanded" : ""}`}>
          {comparisonExpanded && GENDERS.map((gender) => {
            const example = gender === currentGender ? { targetText } : comparisonReferences[gender];
            return (
              <button
                key={gender}
                type="button"
                className={`${selectedGender === gender ? "noun-forms-comparison-option noun-forms-comparison-option-active" : "noun-forms-comparison-option"} ${!example ? "noun-forms-comparison-option-unavailable" : ""}`}
                onClick={() => setSelectedGender(gender)}
                disabled={!example}
              >
                <span className={`gender-word-mark gender-word-${gender}`}>
                  {example?.targetText || t(`strategies.grammar.gender.${gender}`)}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            className="noun-forms-comparison-toggle"
            onClick={() => setComparisonExpanded((expanded) => !expanded)}
            aria-label={t("strategies.forms.compare")}
            aria-expanded={comparisonExpanded}
            title={t("strategies.forms.compare")}
          >
            ⇄
          </button>
        </div>
      )}
    </div>
  );
}
