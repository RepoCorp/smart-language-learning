import { useI18n } from "../../i18n";
import type { SessionItem } from "../../types";
import VerbExerciseSelector, {
  type ParsedVerbExerciseGridEntry,
  type VerbPersonKey,
  type VerbTenseKey,
} from "../VerbExerciseSelector";
import WordExerciseActions from "../WordExerciseActions";
import { buildWordExercisePrimaryEntry } from "../wordExercisePrimaryEntry";
import PhraseSelectionList from "./PhraseSelectionList";
import NounFormsStrategyContent from "./forms/NounFormsStrategyContent";
import type { FormsExerciseEntry, NounFormsStrategyContentProps } from "./forms/nounFormsTypes";

export default function FormsStrategyPanel({
  itemType,
  targetText,
  sourceText,
  sourceLanguageLabel,
  loadingExercises,
  exerciseError,
  exerciseRunning,
  wordExerciseEntries,
  selectedExerciseKeys,
  funnyImageExerciseSelectionEntry,
  funnyImageExerciseImageUrl,
  isVerbExerciseGrid,
  verbExerciseGridEntries,
  nounForms,
  compareExerciseEntries,
  onToggleEntry,
  onSelectPerson,
  onSelectTense,
  onOpenFunnyImage,
  openImageIcon,
  exerciseEntryKey,
}: {
  itemType: SessionItem["item_type"];
  targetText: string;
  sourceText: string;
  sourceLanguageLabel: string;
  loadingExercises: boolean;
  exerciseError: string;
  exerciseRunning: boolean;
  wordExerciseEntries: FormsExerciseEntry[];
  selectedExerciseKeys: string[];
  funnyImageExerciseSelectionEntry?: FormsExerciseEntry;
  funnyImageExerciseImageUrl?: string;
  isVerbExerciseGrid: boolean;
  verbExerciseGridEntries: ParsedVerbExerciseGridEntry[];
  nounForms?: NounFormsStrategyContentProps & { generationMode: string };
  compareExerciseEntries: FormsExerciseEntry[];
  onToggleEntry: (entry: FormsExerciseEntry) => void;
  onSelectPerson: (person: VerbPersonKey) => void;
  onSelectTense: (tense: VerbTenseKey) => void;
  onOpenFunnyImage: () => void;
  openImageIcon: JSX.Element;
  exerciseEntryKey: (entry: FormsExerciseEntry) => string;
}): JSX.Element {
  const { t } = useI18n();
  const wordExercisePrimaryEntry = buildWordExercisePrimaryEntry({
    entry: wordExerciseEntries.find((entry) => entry.label === "word"),
    selectedExerciseKeys,
    exerciseRunning,
    exerciseEntryKey,
    onToggleEntry,
  });

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
          ) : nounForms ? (
            <NounFormsStrategyContent {...nounForms} />
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
