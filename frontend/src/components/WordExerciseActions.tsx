import type { ReactNode } from "react";

import { useI18n } from "../i18n";
import DangerousButton from "./DangerousButton";

interface WordExerciseActionsProps {
  exerciseRunning: boolean;
  loadingExercises: boolean;
  generatingFunnyImageExercise: boolean;
  hasWordExercises: boolean;
  hasSelectedExercises: boolean;
  hasFunnyImage: boolean;
  hasOpenFunnyImage: boolean;
  canRegenerateExercises: boolean;
  onUnselectAll: () => void;
  onSelectAll: () => void;
  onSelectRandom: () => void;
  onOpenFunnyImage: () => void;
  onGenerateFunnyImage: () => void;
  onRegenerateExercises: () => void;
  clearAllIcon: ReactNode;
  selectAllIcon: ReactNode;
  randomIcon: ReactNode;
  openImageIcon: ReactNode;
  imageIcon: ReactNode;
  refreshIcon: ReactNode;
}

export default function WordExerciseActions({
  exerciseRunning,
  loadingExercises,
  generatingFunnyImageExercise,
  hasWordExercises,
  hasSelectedExercises,
  hasFunnyImage,
  hasOpenFunnyImage,
  canRegenerateExercises,
  onUnselectAll,
  onSelectAll,
  onSelectRandom,
  onOpenFunnyImage,
  onGenerateFunnyImage,
  onRegenerateExercises,
  clearAllIcon,
  selectAllIcon,
  randomIcon,
  openImageIcon,
  imageIcon,
  refreshIcon,
}: WordExerciseActionsProps): JSX.Element {
  const { t } = useI18n();

  return (
    <div className="exercise-selection-actions">
      <button
        type="button"
        className="secondary-button exercise-action-icon-button"
        onClick={onUnselectAll}
        disabled={exerciseRunning || !hasSelectedExercises}
        aria-label={t("newItem.exercisesUnselectAll")}
        title={t("newItem.exercisesUnselectAll")}
      >
        {clearAllIcon}
      </button>
      <button
        type="button"
        className="secondary-button exercise-action-icon-button"
        onClick={onSelectAll}
        disabled={exerciseRunning || !hasWordExercises}
        aria-label={t("newItem.exercisesSelectAll")}
        title={t("newItem.exercisesSelectAll")}
      >
        {selectAllIcon}
      </button>
      <button
        type="button"
        className="secondary-button exercise-action-icon-button"
        onClick={onSelectRandom}
        disabled={exerciseRunning || !hasWordExercises}
        aria-label={t("newItem.exercisesRandomSelection")}
        title={t("newItem.exercisesRandomSelection")}
      >
        {randomIcon}
      </button>
      {hasOpenFunnyImage && (
        <button
          type="button"
          className="secondary-button exercise-action-icon-button"
          onClick={onOpenFunnyImage}
          aria-label={t("newItem.exercisesFunnyImageShow")}
          title={t("newItem.exercisesFunnyImageShow")}
        >
          {openImageIcon}
        </button>
      )}
      <div className="exercise-image-actions">
        {hasFunnyImage ? (
          <DangerousButton
            className="secondary-button dangerous-action-button exercise-action-icon-button"
            onConfirm={onGenerateFunnyImage}
            disabled={generatingFunnyImageExercise || !canRegenerateExercises}
            aria-label={generatingFunnyImageExercise ? t("newItem.exercisesFunnyImageGenerating") : t("newItem.exercisesFunnyImageGenerate")}
            title={generatingFunnyImageExercise ? t("newItem.exercisesFunnyImageGenerating") : t("newItem.exercisesFunnyImageGenerate")}
          >
            {imageIcon}
          </DangerousButton>
        ) : (
          <button
            type="button"
            className="secondary-button exercise-action-icon-button"
            onClick={onGenerateFunnyImage}
            disabled={generatingFunnyImageExercise || !canRegenerateExercises}
            aria-label={generatingFunnyImageExercise ? t("newItem.exercisesFunnyImageGenerating") : t("newItem.exercisesFunnyImageGenerate")}
            title={generatingFunnyImageExercise ? t("newItem.exercisesFunnyImageGenerating") : t("newItem.exercisesFunnyImageGenerate")}
          >
            {imageIcon}
          </button>
        )}
      </div>
      <DangerousButton
        className="secondary-button dangerous-action-button exercise-action-icon-button"
        onConfirm={onRegenerateExercises}
        disabled={exerciseRunning || loadingExercises || !canRegenerateExercises}
        aria-label={loadingExercises ? t("newItem.exercisesRegenerating") : t("newItem.exercisesRegenerate")}
        title={loadingExercises ? t("newItem.exercisesRegenerating") : t("newItem.exercisesRegenerate")}
      >
        {refreshIcon}
      </DangerousButton>
    </div>
  );
}
