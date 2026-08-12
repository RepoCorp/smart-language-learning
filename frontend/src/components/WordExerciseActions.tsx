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
  onOpenFunnyImage: () => void;
  onGenerateFunnyImage: () => void;
  openImageIcon: ReactNode;
  imageIcon: ReactNode;
  showOpenImage?: boolean;
  showGenerateImage?: boolean;
}

export default function WordExerciseActions({
  exerciseRunning,
  loadingExercises,
  generatingFunnyImageExercise,
  hasWordExercises,
  hasFunnyImage,
  hasOpenFunnyImage,
  onOpenFunnyImage,
  onGenerateFunnyImage,
  openImageIcon,
  imageIcon,
  showOpenImage = true,
  showGenerateImage = true,
}: WordExerciseActionsProps): JSX.Element {
  const { t } = useI18n();

  return (
    <div className="exercise-selection-actions">
      {showOpenImage && hasOpenFunnyImage && (
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
      {showGenerateImage && <div className="exercise-image-actions">
        {hasFunnyImage ? (
          <DangerousButton
            className="secondary-button dangerous-action-button exercise-action-icon-button"
            onConfirm={onGenerateFunnyImage}
            disabled={generatingFunnyImageExercise || !hasWordExercises}
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
            disabled={generatingFunnyImageExercise || !hasWordExercises}
            aria-label={generatingFunnyImageExercise ? t("newItem.exercisesFunnyImageGenerating") : t("newItem.exercisesFunnyImageGenerate")}
            title={generatingFunnyImageExercise ? t("newItem.exercisesFunnyImageGenerating") : t("newItem.exercisesFunnyImageGenerate")}
          >
            {imageIcon}
          </button>
        )}
      </div>}
    </div>
  );
}
