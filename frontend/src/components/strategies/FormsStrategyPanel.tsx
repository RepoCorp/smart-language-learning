import { useI18n } from "../../i18n";
import type { SessionItem } from "../../types";
import NounExerciseSelector from "../NounExerciseSelector";
import VerbExerciseSelector, { type VerbPersonKey, type VerbTenseKey } from "../VerbExerciseSelector";
import WordExerciseActions from "../WordExerciseActions";
import { buildGermanPluralPrimaryEntry, buildWordExercisePrimaryEntry } from "../wordExercisePrimaryEntry";
import PhraseSelectionList from "./PhraseSelectionList";

type ExerciseEntry = {
  label?: string;
  source: string;
  target: string;
};

export default function FormsStrategyPanel({
  itemType,
  targetText,
  sourceText,
  sourceLanguageLabel,
  loadingExercises,
  exerciseError,
  exerciseRunning,
  generatingFunnyImageExercise,
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
  onGenerateFunnyImage,
  openImageIcon,
  imageIcon,
  exerciseEntryKey,
}: {
  itemType: SessionItem["item_type"];
  targetText: string;
  sourceText: string;
  sourceLanguageLabel: string;
  loadingExercises: boolean;
  exerciseError: string;
  exerciseRunning: boolean;
  generatingFunnyImageExercise: boolean;
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
  nounExerciseSections: Array<{
    key: string;
    questionTargetText?: string;
    questionSourceText?: string;
    phrases: Array<{ label?: string; source_text: string; target_text: string }>;
  }>;
  generatingNounCaseKey?: "" | "nominative" | "accusative" | "dative" | "genitive";
  compareExerciseEntries: ExerciseEntry[];
  onToggleEntry: (entry: ExerciseEntry) => void;
  onSelectPerson: (person: VerbPersonKey) => void;
  onSelectTense: (tense: VerbTenseKey) => void;
  onSelectKeys: (keys: string[]) => void;
  onGenerateCase: (caseKey: "nominative" | "accusative" | "dative" | "genitive") => void;
  onOpenFunnyImage: () => void;
  onGenerateFunnyImage: () => void;
  openImageIcon: JSX.Element;
  imageIcon: JSX.Element;
  exerciseEntryKey: (entry: ExerciseEntry) => string;
}): JSX.Element {
  const { t } = useI18n();
  const wordExercisePrimaryEntry = buildWordExercisePrimaryEntry({
    entry: wordOnlyExerciseEntry,
    pluralGerman: isNounSectionedExercise ? "" : pluralGerman,
    notes: isNounSectionedExercise ? "" : notes,
    selectedExerciseKeys,
    exerciseRunning,
    exerciseEntryKey,
    onToggleEntry,
  });
  const nounPluralPrimaryEntry = isNounSectionedExercise ? buildGermanPluralPrimaryEntry({
    entry: wordOnlyExerciseEntry,
    pluralGerman,
    notes,
    selectedExerciseKeys,
    exerciseRunning,
    exerciseEntryKey,
    onToggleEntry,
  }) : undefined;

  return (
    <div className={isVerbExerciseGrid ? "verb-exercise-modal" : ""}>
      {loadingExercises && <p className="hint">{t("newItem.exercisesGenerating")}</p>}
      {exerciseError && <p className="error">{exerciseError}</p>}
      {itemType === "word" && (
        <>
          <WordExerciseActions
            exerciseRunning={exerciseRunning}
            loadingExercises={loadingExercises}
            generatingFunnyImageExercise={generatingFunnyImageExercise}
            hasWordExercises={wordExerciseEntries.length > 0}
            hasFunnyImage={Boolean(funnyImageExerciseSelectionEntry)}
            hasOpenFunnyImage={Boolean(funnyImageExerciseImageUrl && funnyImageExerciseSelectionEntry)}
            onOpenFunnyImage={onOpenFunnyImage}
            onGenerateFunnyImage={onGenerateFunnyImage}
            openImageIcon={openImageIcon}
            imageIcon={imageIcon}
          />
          {generatingFunnyImageExercise && (
            <p className="hint">{t("newItem.exercisesFunnyImagePending")}</p>
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
            <NounExerciseSelector
              primaryEntry={wordExercisePrimaryEntry}
              extraPrimaryEntries={nounPluralPrimaryEntry ? [nounPluralPrimaryEntry] : []}
              sections={nounExerciseSections}
              selectedExerciseKeys={selectedExerciseKeys}
              exerciseRunning={exerciseRunning}
              generatingCaseKey={generatingNounCaseKey || undefined}
              exerciseEntryKey={exerciseEntryKey}
              onToggleEntry={onToggleEntry}
              onSelectKeys={onSelectKeys}
              onGenerateCase={onGenerateCase}
            />
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
