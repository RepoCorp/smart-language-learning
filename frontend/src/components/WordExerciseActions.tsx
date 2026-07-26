import type { ReactNode } from "react";

import { useI18n } from "../i18n";
import DangerousButton from "./DangerousButton";

interface WordExerciseActionsProps {
  exerciseRunning: boolean;
  loadingExercises: boolean;
  generatingFunnyImageExercise: boolean;
  hasWordExercises: boolean;
  hasFunnyImage: boolean;
  hasOpenFunnyImage: boolean;
  canRegenerateExercises: boolean;
  onOpenFunnyImage: () => void;
  onGenerateFunnyImage: () => void;
  onRegenerateExercises: () => void;
  openImageIcon: ReactNode;
  imageIcon: ReactNode;
  refreshIcon: ReactNode;
}

export default function WordExerciseActions({
  exerciseRunning,
  loadingExercises,
  generatingFunnyImageExercise,
  hasWordExercises,
  hasFunnyImage,
  hasOpenFunnyImage,
  canRegenerateExercises,
  onOpenFunnyImage,
  onGenerateFunnyImage,
  onRegenerateExercises,
  openImageIcon,
  imageIcon,
  refreshIcon,
}: WordExerciseActionsProps): JSX.Element {
  const { t } = useI18n();

  return (
    <div className="exercise-selection-actions">
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
