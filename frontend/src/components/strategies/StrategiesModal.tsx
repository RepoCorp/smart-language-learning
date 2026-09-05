import { useMemo, type ReactNode } from "react";

import BlockingLoadingOverlay from "../BlockingLoadingOverlay";
import GenderedNounText, { germanNounGender } from "../GenderedNounText";
import { useI18n } from "../../i18n";
import type { StudyLanguageCode } from "../../types";
import {
  PHRASE_STRATEGIES,
  WORD_STRATEGIES,
} from "./strategyConstants";

export default function StrategiesModal({
  itemType,
  sourceText,
  targetText,
  targetLanguage,
  wordType,
  selectedStrategy,
  onSelectedStrategyChange,
  onClose,
  strategyContent,
  loading = false,
  loadingMessage = "",
}: {
  itemType: "word" | "phrase";
  sourceText: string;
  targetText: string;
  targetLanguage: StudyLanguageCode;
  wordType: string;
  selectedStrategy: string;
  onSelectedStrategyChange: (strategy: string) => void;
  onClose: () => void;
  strategyContent: ReactNode;
  loading?: boolean;
  loadingMessage?: string;
}): JSX.Element {
  const { t } = useI18n();
  const strategies = useMemo(
    () => (itemType === "word" ? [...WORD_STRATEGIES] : [...PHRASE_STRATEGIES]),
    [itemType],
  );
  const labelFor = (strategy: string): string => {
    if (itemType === "phrase" && strategy === "Forms") {
      return t("strategies.option.repeat");
    }
    return t(`strategies.option.${strategy.toLowerCase()}`);
  };
  const nounGender = itemType === "word" && targetLanguage === "german" && wordType.trim().toLowerCase() === "noun"
    ? germanNounGender(targetText)
    : null;

  return (
    <div className="blocking-modal-overlay" role="dialog" aria-modal="true">
      <div className="blocking-modal related-dialogs-modal word-strategies-modal">
        <button type="button" className="modal-corner-close" aria-label={t("newItem.closeRelatedDialogs")} onClick={onClose}>
          ×
        </button>
        <p className="exercise-modal-header word-strategies-modal-title">
          <strong>{t("newItem.strategiesTitle")}</strong>
        </p>
        <div className="word-strategies-body">
          <div className="word-strategies-item-card">
            <p className="word-strategies-item-target">
              {nounGender ? <GenderedNounText text={targetText} targetText={targetText} gender={nounGender} /> : targetText || sourceText}
            </p>
            <p className="word-strategies-item-source">{sourceText}</p>
          </div>
          <label className="word-strategies-select-group" htmlFor="word-strategy-select">
            <select
              id="word-strategy-select"
              className="word-strategies-select"
              value={selectedStrategy}
              onChange={(event) => onSelectedStrategyChange(event.target.value)}
            >
              {strategies.map((strategy, index) => (
                <option key={strategy} value={strategy}>
                  {index + 1}. {labelFor(strategy)}
                </option>
              ))}
            </select>
          </label>
          <BlockingLoadingOverlay loading={loading} message={loadingMessage}>
            {strategyContent}
          </BlockingLoadingOverlay>
        </div>
      </div>
    </div>
  );
}
