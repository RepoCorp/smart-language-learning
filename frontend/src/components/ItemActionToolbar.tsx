import type { FocusEvent, PointerEvent } from "react";

import { useI18n } from "../i18n";
import DangerousButton from "./DangerousButton";

type ItemActionIconName =
  | "test"
  | "exercise"
  | "warmup"
  | "letters"
  | "builder"
  | "dialogs"
  | "questions"
  | "compareWords"
  | "audio"
  | "refresh";

function ItemActionIcon({ name }: { name: ItemActionIconName }): JSX.Element {
  const commonProps = {
    className: "item-action-icon",
    viewBox: "0 0 24 24",
    "aria-hidden": true,
  };

  if (name === "exercise") {
    return (
      <svg {...commonProps}>
        <path d="M8 5v14l11-7-11-7Z" />
        <path d="M4 6h1M4 12h1M4 18h1" />
      </svg>
    );
  }
  if (name === "test") {
    return (
      <svg {...commonProps}>
        <path d="M5 12h6" />
        <path d="m9 8 4 4-4 4" />
        <path d="M14 7h5v10h-5" />
      </svg>
    );
  }
  if (name === "warmup") {
    return (
      <svg {...commonProps}>
        <path d="M12 3l1.4 4.2L18 9l-4.6 1.8L12 15l-1.4-4.2L6 9l4.6-1.8L12 3Z" />
        <path d="M6 15l.7 2.1L9 18l-2.3.9L6 21l-.7-2.1L3 18l2.3-.9L6 15Z" />
      </svg>
    );
  }
  if (name === "letters") {
    return (
      <svg {...commonProps}>
        <path d="M4 18 9 6l5 12" />
        <path d="M6 14h6" />
        <path d="M16 8h4M18 6v4" />
      </svg>
    );
  }
  if (name === "builder") {
    return (
      <svg {...commonProps}>
        <rect x="3" y="5" width="7" height="5" rx="1" />
        <rect x="14" y="5" width="7" height="5" rx="1" />
        <rect x="8" y="14" width="8" height="5" rx="1" />
      </svg>
    );
  }
  if (name === "dialogs") {
    return (
      <svg {...commonProps}>
        <path d="M4 5h11v8H8l-4 4V5Z" />
        <path d="M13 11h7v7l-3-3h-4" />
      </svg>
    );
  }
  if (name === "questions") {
    return (
      <svg {...commonProps}>
        <path d="M9 9a3 3 0 1 1 4.4 2.6c-.9.5-1.4 1.1-1.4 2.4" />
        <path d="M12 18h.01" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    );
  }
  if (name === "compareWords") {
    return (
      <svg {...commonProps}>
        <circle cx="8" cy="10" r="3" />
        <circle cx="16" cy="10" r="3" />
        <path d="M10.5 10h3" />
        <path d="M8 14.5c-2 0-3.5 1.2-4 3.5h8c-.5-2.3-2-3.5-4-3.5Z" />
        <path d="M16 14.5c-2 0-3.5 1.2-4 3.5h8c-.5-2.3-2-3.5-4-3.5Z" />
      </svg>
    );
  }
  if (name === "audio") {
    return (
      <svg {...commonProps}>
        <path d="M4 10v4h4l4 3V7l-4 3H4Z" />
        <path d="M15.5 9.5a3.5 3.5 0 0 1 0 5" />
        <path d="M19 5v4h-4" />
        <path d="M15 19v-4h4" />
        <path d="M19 9a7 7 0 0 0-11-3.6" />
        <path d="M15 15a7 7 0 0 1-11 3.6" />
      </svg>
    );
  }
  return (
    <svg {...commonProps}>
      <path d="M20 12a8 8 0 0 1-13.7 5.7" />
      <path d="M4 12A8 8 0 0 1 17.7 6.3" />
      <path d="M17 3v4h4" />
      <path d="M7 21v-4H3" />
    </svg>
  );
}

type TooltipEvent = PointerEvent<HTMLButtonElement> | FocusEvent<HTMLButtonElement>;

type Props = {
  itemType: "word" | "phrase";
  loadingExercises: boolean;
  regeneratingAudio: boolean;
  refreshingWord: boolean;
  showMobileActionLabels: boolean;
  hasQuestions: boolean;
  hasCompareWordsContent: boolean;
  onOpenExercises: () => void;
  onOpenTest: () => void;
  onOpenWordIntroPractice: () => void;
  onOpenWordLetterPractice: () => void;
  onOpenPhraseBuilder: () => void;
  onOpenRelatedDialogs: () => void;
  onOpenQuestions: () => void;
  onOpenCompareWords: () => void;
  onRegenerateAudio: () => void;
  onRefreshWordData: () => void;
  onShowTooltip: (event: TooltipEvent, label: string) => void;
  onHideTooltip: () => void;
};

function iconButtonProps(
  label: string,
  onShowTooltip: (event: TooltipEvent, label: string) => void,
  onHideTooltip: () => void,
): {
  "aria-label": string;
  title: string;
  "data-mobile-label": string;
  onPointerEnter: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerLeave: () => void;
  onFocus: (event: FocusEvent<HTMLButtonElement>) => void;
  onBlur: () => void;
} {
  return {
    "aria-label": label,
    title: label,
    "data-mobile-label": label,
    onPointerEnter: (event) => onShowTooltip(event, label),
    onPointerLeave: onHideTooltip,
    onFocus: (event) => onShowTooltip(event, label),
    onBlur: onHideTooltip,
  };
}

export default function ItemActionToolbar({
  itemType,
  loadingExercises,
  regeneratingAudio,
  refreshingWord,
  showMobileActionLabels,
  hasQuestions,
  hasCompareWordsContent,
  onOpenExercises,
  onOpenTest,
  onOpenWordIntroPractice,
  onOpenWordLetterPractice,
  onOpenPhraseBuilder,
  onOpenRelatedDialogs,
  onOpenQuestions,
  onOpenCompareWords,
  onRegenerateAudio,
  onRefreshWordData,
  onShowTooltip,
  onHideTooltip,
}: Props): JSX.Element {
  const { t } = useI18n();
  const highlightClassName = "item-action-button-has-content";

  return (
    <div className={showMobileActionLabels ? "mobile-action-labels-expanded" : undefined}>
      <div className="actions item-actions-toolbar">
        <div className="item-action-group item-action-group-primary" aria-label={t("newItem.actionGroupPractice")}>
          <button
            type="button"
            className="secondary-button item-action-button item-action-button-icon item-action-button-primary"
            onClick={onOpenExercises}
            disabled={loadingExercises}
            {...iconButtonProps(t("newItem.openExercises"), onShowTooltip, onHideTooltip)}
          >
            <ItemActionIcon name="exercise" />
          </button>
          <button
            type="button"
            className="secondary-button item-action-button item-action-button-icon item-action-button-primary"
            onClick={onOpenTest}
            disabled={loadingExercises}
            {...iconButtonProps(t("newItem.openItemTest"), onShowTooltip, onHideTooltip)}
          >
            <ItemActionIcon name="test" />
          </button>
          {itemType === "word" && (
            <button
              type="button"
              className="secondary-button item-action-button item-action-button-icon item-action-button-primary"
              onClick={onOpenWordIntroPractice}
              {...iconButtonProps(t("newItem.openWordIntroPractice"), onShowTooltip, onHideTooltip)}
            >
              <ItemActionIcon name="warmup" />
            </button>
          )}
          {itemType === "word" && (
            <button
              type="button"
              className="secondary-button item-action-button item-action-button-icon item-action-button-primary"
              onClick={onOpenWordLetterPractice}
              {...iconButtonProps(t("newItem.openWordLetterPractice"), onShowTooltip, onHideTooltip)}
            >
              <ItemActionIcon name="letters" />
            </button>
          )}
          {itemType === "phrase" && (
            <button
              type="button"
              className="secondary-button item-action-button item-action-button-icon item-action-button-primary"
              onClick={onOpenPhraseBuilder}
              {...iconButtonProps(t("newItem.openPhraseBuilder"), onShowTooltip, onHideTooltip)}
            >
              <ItemActionIcon name="builder" />
            </button>
          )}
        </div>
        <div className="item-action-group" aria-label={t("newItem.actionGroupExplore")}>
          <button
            type="button"
            className="secondary-button item-action-button item-action-button-icon"
            onClick={onOpenRelatedDialogs}
            {...iconButtonProps(t("newItem.openRelatedDialogs"), onShowTooltip, onHideTooltip)}
          >
            <ItemActionIcon name="dialogs" />
          </button>
          <button
            type="button"
            className={`secondary-button item-action-button item-action-button-icon ${hasQuestions ? highlightClassName : ""}`}
            onClick={onOpenQuestions}
            {...iconButtonProps(t("newItem.openQuestions"), onShowTooltip, onHideTooltip)}
          >
            <ItemActionIcon name="questions" />
          </button>
          {itemType === "word" && (
            <button
              type="button"
              className={`secondary-button item-action-button item-action-button-icon ${hasCompareWordsContent ? highlightClassName : ""}`}
              onClick={onOpenCompareWords}
              {...iconButtonProps(t("newItem.openCompareWords"), onShowTooltip, onHideTooltip)}
            >
              <ItemActionIcon name="compareWords" />
            </button>
          )}
        </div>
        <div className="item-action-group item-action-group-danger" aria-label={t("newItem.actionGroupDanger")}>
          <DangerousButton
            className="secondary-button item-action-button item-action-button-icon dangerous-action-button"
            onConfirm={onRegenerateAudio}
            disabled={regeneratingAudio || refreshingWord}
            {...iconButtonProps(
              regeneratingAudio ? t("newItem.audioRegenerating") : t("newItem.regenerateAudio"),
              onShowTooltip,
              onHideTooltip,
            )}
          >
            <ItemActionIcon name="audio" />
          </DangerousButton>
          {itemType === "word" && (
            <DangerousButton
              className="secondary-button item-action-button item-action-button-icon dangerous-action-button"
              onConfirm={onRefreshWordData}
              disabled={refreshingWord || regeneratingAudio}
              {...iconButtonProps(
                refreshingWord ? t("newItem.wordRefreshRunning") : t("newItem.wordRefresh"),
                onShowTooltip,
                onHideTooltip,
              )}
            >
              <ItemActionIcon name="refresh" />
            </DangerousButton>
          )}
        </div>
      </div>
    </div>
  );
}
