import { useMemo, type ReactNode } from "react";

import { useI18n } from "../i18n";

const WORD_STRATEGIES = [
  "Repeat",
  "Personalize",
  "Practice",
  "Connect",
  "Visualize",
  "Sing",
  "Walk",
  "Act",
  "Decode",
  "Encounter",
  "Compare",
] as const;

const PHRASE_STRATEGIES = [
  "Repeat",
  "Practice",
  "Connect",
  "Visualize",
  "Sing",
  "Walk",
  "Act",
  "Encounter",
  "Compare",
] as const;

export default function StrategiesModal({
  itemType,
  sourceText,
  targetText,
  pluralText,
  selectedStrategy,
  onSelectedStrategyChange,
  onClose,
  strategyContent,
}: {
  itemType: "word" | "phrase";
  sourceText: string;
  targetText: string;
  pluralText?: string;
  selectedStrategy: string;
  onSelectedStrategyChange: (strategy: string) => void;
  onClose: () => void;
  strategyContent: ReactNode;
}): JSX.Element {
  const { t } = useI18n();
  const strategies = useMemo(
    () => (itemType === "word" ? [...WORD_STRATEGIES] : [...PHRASE_STRATEGIES]),
    [itemType],
  );

  return (
    <div className="blocking-modal-overlay" role="dialog" aria-modal="true">
      <div className="blocking-modal related-dialogs-modal word-strategies-modal">
        <button type="button" className="modal-corner-close" aria-label={t("newItem.closeRelatedDialogs")} onClick={onClose}>
          ×
        </button>
        <p className="exercise-modal-header">
          <strong>{t("newItem.strategiesTitle")}</strong>
        </p>
        <p className="hint exercise-modal-description">{t("newItem.strategiesDescription")}</p>
        <div className="word-strategies-body">
          <div className="word-strategies-item-card">
            <p className="word-strategies-item-kicker">
              <strong>{itemType === "word" ? t("newItem.word") : t("newItem.phrase")}</strong>
            </p>
            <p className="word-strategies-item-target">{targetText || sourceText}</p>
            {!!pluralText?.trim() && itemType === "word" && (
              <p className="word-strategies-item-plural">{pluralText.trim()}</p>
            )}
            <p className="word-strategies-item-source">{sourceText}</p>
          </div>
          <label className="word-strategies-select-group" htmlFor="word-strategy-select">
            <span className="word-strategies-select-label">{t("newItem.strategiesSelectLabel")}</span>
            <select
              id="word-strategy-select"
              className="word-strategies-select"
              value={selectedStrategy}
              onChange={(event) => onSelectedStrategyChange(event.target.value)}
            >
              {strategies.map((strategy, index) => (
                <option key={strategy} value={strategy}>
                  {index + 1}. {strategy}
                </option>
              ))}
            </select>
          </label>
          {strategyContent}
        </div>
      </div>
    </div>
  );
}
