import type { ReactNode } from "react";

import { useI18n } from "../../i18n";

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
}): JSX.Element {
  const { t } = useI18n();

  return (
    <div className="strategy-loop-panel strategy-repeat-panel">
      <div className="exercise-modal-scroll">
        {body}
      </div>

      <div className="exercise-modal-footer">
        {(onUnselectAll || onSelectAll || onSelectRandom) && (
          <div className="strategy-loop-selection-actions">
            {onUnselectAll && (
              <button type="button" className="secondary-button" onClick={onUnselectAll} disabled={isRunning || !hasSelectedEntries}>
                {t("newItem.exercisesUnselectAll")}
              </button>
            )}
            {onSelectAll && (
              <button type="button" className="secondary-button" onClick={onSelectAll} disabled={isRunning || !canSelectEntries}>
                {t("newItem.exercisesSelectAll")}
              </button>
            )}
            {onSelectRandom && (
              <button type="button" className="secondary-button" onClick={onSelectRandom} disabled={isRunning || !canSelectEntries}>
                {t("newItem.exercisesRandomSelection")}
              </button>
            )}
          </div>
        )}
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
              className="secondary-button exercise-mute-button"
              aria-pressed={isMuted}
              onClick={onToggleMute}
            >
              {isMuted ? t("newItem.exercisesUnmute") : t("newItem.exercisesMute")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
