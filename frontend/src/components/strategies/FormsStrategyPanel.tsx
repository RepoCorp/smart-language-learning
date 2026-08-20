import { useEffect, useState } from "react";

import { useI18n } from "../../i18n";
import type { ExercisePhraseSection, SessionItem, StudyLanguageCode } from "../../types";
import NounExerciseSelector from "../NounExerciseSelector";
import VerbExerciseSelector, { type VerbPersonKey, type VerbTenseKey } from "../VerbExerciseSelector";
import WordExerciseActions from "../WordExerciseActions";
import { buildGermanPluralPrimaryEntry, buildWordExercisePrimaryEntry } from "../wordExercisePrimaryEntry";
import PhraseSelectionList from "./PhraseSelectionList";
import { germanNounFormsReferences } from "./germanNounFormsReferences";
import type { NounGender } from "./useGrammarExamples";

type ExerciseEntry = {
  label?: string;
  source: string;
  target: string;
};

const NOUN_GENDERS: NounGender[] = ["masculine", "feminine", "neuter"];

function nounGender(targetText: string): NounGender | null {
  const article = targetText.trim().split(/\s+/, 1)[0]?.toLowerCase();
  if (article === "der") return "masculine";
  if (article === "die") return "feminine";
  if (article === "das") return "neuter";
  return null;
}

export default function FormsStrategyPanel({
  itemType,
  targetText,
  sourceText,
  sourceLanguage,
  sourceLanguageLabel,
  loadingExercises,
  exerciseError,
  exerciseRunning,
  wordExerciseEntries,
  selectedExerciseKeys,
  funnyImageExerciseSelectionEntry,
  funnyImageExerciseImageUrl,
  isVerbExerciseGrid,
  isNounSectionedExercise,
  pluralGerman,
  notes,
  wordOnlyExerciseEntry,
  verbExerciseGridEntries,
  nounExerciseSections,
  generatingNounCaseKey,
  compareExerciseEntries,
  onToggleEntry,
  onSelectPerson,
  onSelectTense,
  onSelectKeys,
  onGenerateCase,
  onOpenFunnyImage,
  openImageIcon,
  exerciseEntryKey,
}: {
  itemType: SessionItem["item_type"];
  targetText: string;
  sourceText: string;
  sourceLanguage: StudyLanguageCode;
  sourceLanguageLabel: string;
  loadingExercises: boolean;
  exerciseError: string;
  exerciseRunning: boolean;
  wordExerciseEntries: ExerciseEntry[];
  selectedExerciseKeys: string[];
  funnyImageExerciseSelectionEntry?: ExerciseEntry;
  funnyImageExerciseImageUrl?: string;
  isVerbExerciseGrid: boolean;
  isNounSectionedExercise: boolean;
  pluralGerman: string;
  notes: string;
  wordOnlyExerciseEntry?: ExerciseEntry;
  verbExerciseGridEntries: Array<{ person: string; tense: string; entry: ExerciseEntry }>;
  nounExerciseSections: ExercisePhraseSection[];
  generatingNounCaseKey?: "" | "nominative" | "accusative" | "dative" | "genitive";
  compareExerciseEntries: ExerciseEntry[];
  onToggleEntry: (entry: ExerciseEntry) => void;
  onSelectPerson: (person: VerbPersonKey) => void;
  onSelectTense: (tense: VerbTenseKey) => void;
  onSelectKeys: (keys: string[]) => void;
  onGenerateCase: (caseKey: "nominative" | "accusative" | "dative" | "genitive") => void;
  onOpenFunnyImage: () => void;
  openImageIcon: JSX.Element;
  exerciseEntryKey: (entry: ExerciseEntry) => string;
}): JSX.Element {
  const { t } = useI18n();
  const currentGender = isNounSectionedExercise ? nounGender(targetText) : null;
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
  const displayedPluralGerman = selectedComparison?.pluralGerman || pluralGerman;
  const displayedSections = selectedComparison?.sections || nounExerciseSections;
  const displayedWordEntry = selectedComparison
    ? { source: displayedSourceText, target: displayedTargetText }
    : wordOnlyExerciseEntry;
  const wordExercisePrimaryEntry = buildWordExercisePrimaryEntry({
    entry: displayedWordEntry,
    pluralGerman: isNounSectionedExercise ? "" : displayedPluralGerman,
    notes: isNounSectionedExercise ? "" : notes,
    selectedExerciseKeys,
    exerciseRunning,
    exerciseEntryKey,
    onToggleEntry,
  });
  const nounPluralPrimaryEntry = isNounSectionedExercise ? buildGermanPluralPrimaryEntry({
    entry: displayedWordEntry,
    pluralGerman: displayedPluralGerman,
    notes,
    selectedExerciseKeys,
    exerciseRunning,
    exerciseEntryKey,
    onToggleEntry,
  }) : undefined;

  return (
    <div className={isVerbExerciseGrid ? "verb-exercise-modal" : "noun-forms-strategy-panel"}>
      {loadingExercises && <p className="hint">{t("newItem.exercisesGenerating")}</p>}
      {exerciseError && <p className="error">{exerciseError}</p>}
      {itemType === "word" && (
        <>
          {funnyImageExerciseImageUrl && funnyImageExerciseSelectionEntry && (
            <WordExerciseActions
              exerciseRunning={exerciseRunning}
              loadingExercises={loadingExercises}
              generatingFunnyImageExercise={false}
              hasWordExercises={wordExerciseEntries.length > 0}
              hasFunnyImage={Boolean(funnyImageExerciseSelectionEntry)}
              hasOpenFunnyImage
              onOpenFunnyImage={onOpenFunnyImage}
              onGenerateFunnyImage={() => {}}
              openImageIcon={openImageIcon}
              imageIcon={null}
              showGenerateImage={false}
            />
          )}
          {funnyImageExerciseSelectionEntry && (
            <div className="funny-image-phrase-row">
              <PhraseSelectionList
                entries={[{ ...funnyImageExerciseSelectionEntry, key: exerciseEntryKey(funnyImageExerciseSelectionEntry) }]}
                selectedKeys={selectedExerciseKeys}
                onToggleEntry={onToggleEntry}
                disabled={exerciseRunning}
              />
            </div>
          )}
          {isVerbExerciseGrid ? (
            <VerbExerciseSelector
              ariaLabel={t("newItem.exercisesTitle")}
              primaryEntry={wordExercisePrimaryEntry}
              gridEntries={verbExerciseGridEntries}
              selectedExerciseKeys={selectedExerciseKeys}
              exerciseRunning={exerciseRunning}
              exerciseEntryKey={exerciseEntryKey}
              onToggleEntry={onToggleEntry}
              onSelectPerson={onSelectPerson}
              onSelectTense={onSelectTense}
            />
          ) : isNounSectionedExercise ? (
            <div className="noun-forms-table-content">
              <NounExerciseSelector
                primaryEntry={wordExercisePrimaryEntry}
                extraPrimaryEntries={nounPluralPrimaryEntry ? [nounPluralPrimaryEntry] : []}
                sections={displayedSections}
                selectedExerciseKeys={selectedExerciseKeys}
                exerciseRunning={exerciseRunning}
                generatingCaseKey={generatingNounCaseKey || undefined}
                allowCaseRegeneration={!selectedComparison}
                exerciseEntryKey={exerciseEntryKey}
                onToggleEntry={onToggleEntry}
                onSelectKeys={onSelectKeys}
                onGenerateCase={onGenerateCase}
              />
              {currentGender && (
                <div className={`noun-forms-comparison ${comparisonExpanded ? "noun-forms-comparison-expanded" : ""}`}>
                  {comparisonExpanded && NOUN_GENDERS.map((gender) => {
                    const example = gender === currentGender
                      ? { targetText }
                      : comparisonReferences[gender];
                    return (
                      <button
                        key={gender}
                        type="button"
                        className={`${selectedGender === gender ? "noun-forms-comparison-option noun-forms-comparison-option-active" : "noun-forms-comparison-option"} ${!example ? "noun-forms-comparison-option-unavailable" : ""}`}
                        onClick={() => setSelectedGender(gender)}
                        disabled={!example}
                      >
                        {example?.targetText || t(`strategies.grammar.gender.${gender}`)}
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
          ) : (
            <PhraseSelectionList
              entries={wordExerciseEntries.map((entry) => ({ ...entry, key: exerciseEntryKey(entry) }))}
              selectedKeys={selectedExerciseKeys}
              onToggleEntry={onToggleEntry}
              disabled={exerciseRunning}
            />
          )}
          {!!compareExerciseEntries.length && (
            <div className="compare-exercise-section">
              <p className="compare-exercise-title">
                <strong>{t("newItem.compareExerciseTitle")}</strong>
              </p>
              <PhraseSelectionList
                entries={compareExerciseEntries.map((entry) => ({ ...entry, key: exerciseEntryKey(entry) }))}
                selectedKeys={selectedExerciseKeys}
                onToggleEntry={onToggleEntry}
                disabled={exerciseRunning}
              />
            </div>
          )}
        </>
      )}
      {itemType === "word" && wordExerciseEntries.length === 0 && (
        <p className="hint">{t("newItem.exercisesUnavailable")}</p>
      )}
      {itemType === "phrase" && (
        <div className="exercise-section-grid">
          <div className="exercise-section-card exercise-section-card-selected">
            <strong>{t("newItem.exercisesPhraseTitle")}</strong>
            <ul>
              <li>{targetText}</li>
            </ul>
            <div className="exercise-translation-group">
              {sourceLanguageLabel}: {sourceText}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
