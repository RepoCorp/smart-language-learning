import type { ReactNode } from "react";

import { useI18n } from "../../i18n";
import DangerousButton from "../DangerousButton";

function LoopActionIcon({ name }: { name: "clearAll" | "selectAll" | "random" | "refresh" | "mute" | "unmute" }): JSX.Element {
  const commonProps = {
    className: "item-action-icon",
    viewBox: "0 0 24 24",
    "aria-hidden": true,
  };

  if (name === "clearAll") {
    return (
      <svg {...commonProps}>
        <rect x="4" y="5" width="16" height="14" rx="2" />
        <path d="m9 10 6 6" />
        <path d="m15 10-6 6" />
      </svg>
    );
  }
  if (name === "selectAll") {
    return (
      <svg {...commonProps}>
        <rect x="4" y="5" width="16" height="14" rx="2" />
        <path d="m8.5 12 2.2 2.2 4.8-5.2" />
      </svg>
    );
  }
  if (name === "random") {
    return (
      <svg {...commonProps}>
        <path d="M4 8h3l4 8h3" />
        <path d="M14 8h6" />
        <path d="m17 5 3 3-3 3" />
        <path d="M4 16h3l2-4" />
        <path d="M14 16h6" />
        <path d="m17 13 3 3-3 3" />
      </svg>
    );
  }
  if (name === "refresh") {
    return (
      <svg {...commonProps}>
        <path d="M20 12a8 8 0 0 1-13.7 5.7" />
        <path d="M4 12A8 8 0 0 1 17.7 6.3" />
        <path d="M17 3v4h4" />
        <path d="M7 21v-4H3" />
      </svg>
    );
  }
  if (name === "mute") {
    return (
      <svg {...commonProps}>
        <path d="M5 10v4h3l4 4V6L8 10H5z" />
        <path d="m16 10 4 4" />
        <path d="m20 10-4 4" />
      </svg>
    );
  }
  return (
    <svg {...commonProps}>
      <path d="M5 10v4h3l4 4V6L8 10H5z" />
      <path d="M16 9a5 5 0 0 1 0 6" />
      <path d="M18.5 6.5a8.5 8.5 0 0 1 0 11" />
    </svg>
  );
}

export default function StrategyLoopPanel({
  body,
  secondsLeft,
  isRunning,
  isMuted,
  canStart,
  canSelectEntries,
  hasSelectedEntries,
  onUnselectAll,
  onSelectAll,
  onSelectRandom,
  onStart,
  onStop,
  onToggleMute,
  canRegenerateContent,
  regeneratingContent,
  onRegenerateContent,
  additionalDangerAction,
}: {
  body: ReactNode;
  secondsLeft: number;
  isRunning: boolean;
  isMuted: boolean;
  canStart: boolean;
  canSelectEntries?: boolean;
  hasSelectedEntries?: boolean;
  onUnselectAll?: () => void;
  onSelectAll?: () => void;
  onSelectRandom?: () => void;
  onStart: () => void;
  onStop: () => void;
  onToggleMute: () => void;
  canRegenerateContent?: boolean;
  regeneratingContent?: boolean;
  onRegenerateContent?: () => void;
  additionalDangerAction?: ReactNode;
}): JSX.Element {
  const { t } = useI18n();

  return (
    <div className="strategy-loop-panel strategy-repeat-panel">
      <div className="exercise-modal-scroll">
        {body}
      </div>

      <div className="exercise-modal-footer">
        <div className="strategy-loop-footer-row">
          {(onUnselectAll || onSelectAll || onSelectRandom) && (
            <div className="strategy-loop-selection-actions">
              {onUnselectAll && (
                <button
                  type="button"
                  className="secondary-button exercise-action-icon-button"
                  onClick={onUnselectAll}
                  disabled={isRunning || !hasSelectedEntries}
                  aria-label={t("newItem.exercisesUnselectAll")}
                  title={t("newItem.exercisesUnselectAll")}
                >
                  <LoopActionIcon name="clearAll" />
                </button>
              )}
              {onSelectAll && (
                <button
                  type="button"
                  className="secondary-button exercise-action-icon-button"
                  onClick={onSelectAll}
                  disabled={isRunning || !canSelectEntries}
                  aria-label={t("newItem.exercisesSelectAll")}
                  title={t("newItem.exercisesSelectAll")}
                >
                  <LoopActionIcon name="selectAll" />
                </button>
              )}
              {onSelectRandom && (
                <button
                  type="button"
                  className="secondary-button exercise-action-icon-button"
                  onClick={onSelectRandom}
                  disabled={isRunning || !canSelectEntries}
                  aria-label={t("newItem.exercisesRandomSelection")}
                  title={t("newItem.exercisesRandomSelection")}
                >
                  <LoopActionIcon name="random" />
                </button>
              )}
            </div>
          )}
          {(additionalDangerAction || onRegenerateContent) && (
            <div className="strategy-loop-danger-actions">
              {additionalDangerAction}
              {onRegenerateContent && (
                <DangerousButton
                  className="secondary-button dangerous-action-button exercise-action-icon-button"
                  onConfirm={onRegenerateContent}
                  disabled={!canRegenerateContent || Boolean(regeneratingContent)}
                  aria-label={regeneratingContent ? t("newItem.exercisesRegenerating") : t("newItem.exercisesRegenerate")}
                  title={regeneratingContent ? t("newItem.exercisesRegenerating") : t("newItem.exercisesRegenerate")}
                >
                  <LoopActionIcon name="refresh" />
                </DangerousButton>
              )}
            </div>
          )}
        </div>
        <p className="exercise-timer">
          <strong>{t("newItem.exercisesTimeLeft", { seconds: secondsLeft })}</strong>
        </p>

        <div className="actions">
          {!isRunning && (
            <button type="button" onClick={onStart} disabled={!canStart}>
              {t("newItem.exercisesStart")}
            </button>
          )}
          {isRunning && (
            <button type="button" className="secondary-button" onClick={onStop}>
              {t("newItem.exercisesStop")}
            </button>
          )}
          {isRunning && (
            <button
              type="button"
              className="secondary-button exercise-action-icon-button exercise-mute-button"
              aria-pressed={isMuted}
              onClick={onToggleMute}
              aria-label={isMuted ? t("newItem.exercisesUnmute") : t("newItem.exercisesMute")}
              title={isMuted ? t("newItem.exercisesUnmute") : t("newItem.exercisesMute")}
            >
              <LoopActionIcon name={isMuted ? "unmute" : "mute"} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
