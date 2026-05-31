import { useState } from "react";

import { quickAddPhraseFromConversation } from "../api";
import { useI18n } from "../i18n";
import type { StudyLanguageCode } from "../types";

type ActionStatus = "idle" | "saving" | "added" | "exists" | "error";

type PendingPhraseAdd = {
  sourceText: string;
  targetText: string;
};

interface DialogTurnTextProps {
  dialogId: number;
  turnIndex: number;
  sourceText: string;
  targetText: string;
  sourceLanguage: StudyLanguageCode;
  targetLanguage: StudyLanguageCode;
  tokenStatus?: Record<string, ActionStatus>;
  statusKeyPrefix?: string;
  highlightWord?: string;
  hideTargetText?: boolean;
  onTokenClick?: (statusKey: string, token: string, tokenIndex: number) => void;
  onOpenItem?: (itemId: number) => Promise<void>;
  wordMatches?: (token: string, word: string) => boolean;
  showPhraseSelection?: boolean;
}

const cleanToken = (value: string): string => value.replace(/^[^A-Za-zÀ-ÖØ-öø-ÿ]+|[^A-Za-zÀ-ÖØ-öø-ÿ]+$/g, "").trim();
const lineTokens = (line: string): string[] => line.split(/\s+/).filter((part) => part.trim().length > 0);

export default function DialogTurnText({
  dialogId,
  turnIndex,
  sourceText,
  targetText,
  sourceLanguage,
  targetLanguage,
  tokenStatus = {},
  statusKeyPrefix,
  highlightWord = "",
  hideTargetText = false,
  onTokenClick,
  onOpenItem,
  wordMatches,
  showPhraseSelection = true,
}: DialogTurnTextProps): JSX.Element {
  const { t } = useI18n();
  const [selectingPhrase, setSelectingPhrase] = useState<boolean>(false);
  const [selectedTokenIndexes, setSelectedTokenIndexes] = useState<number[]>([]);
  const [phraseStatus, setPhraseStatus] = useState<ActionStatus>("idle");
  const [phraseError, setPhraseError] = useState<string>("");
  const [pendingPhraseAdd, setPendingPhraseAdd] = useState<PendingPhraseAdd | null>(null);
  const prefix = statusKeyPrefix || `${dialogId}-${turnIndex}-target`;
  const tokens = lineTokens(targetText);

  const selectedPhraseTargetText = (): string =>
    [...selectedTokenIndexes]
      .sort((left, right) => left - right)
      .map((index) => cleanToken(tokens[index] || ""))
      .filter(Boolean)
      .join(" ");

  const selectedPhraseTokenClass = (tokenIndex: number): string => {
    if (!selectedTokenIndexes.includes(tokenIndex)) {
      return "";
    }
    const sortedIndexes = [...selectedTokenIndexes].sort((left, right) => left - right);
    const firstIndex = sortedIndexes[0];
    const lastIndex = sortedIndexes[sortedIndexes.length - 1];
    if (tokenIndex === firstIndex && tokenIndex === lastIndex) {
      return "turn-token-button-selected turn-token-button-selected-single";
    }
    if (tokenIndex === firstIndex) {
      return "turn-token-button-selected turn-token-button-selected-start";
    }
    if (tokenIndex === lastIndex) {
      return "turn-token-button-selected turn-token-button-selected-end";
    }
    return "turn-token-button-selected turn-token-button-selected-middle";
  };

  const togglePhraseSelectionToken = (tokenIndex: number): void => {
    setSelectedTokenIndexes((current) => {
      const exists = current.includes(tokenIndex);
      const sortedIndexes = [...current].sort((left, right) => left - right);
      const firstIndex = sortedIndexes[0] ?? tokenIndex;
      const lastIndex = sortedIndexes[sortedIndexes.length - 1] ?? tokenIndex;
      if (exists) {
        if (tokenIndex === firstIndex) {
          return sortedIndexes.slice(1);
        }
        if (tokenIndex === lastIndex) {
          return sortedIndexes.slice(0, -1);
        }
        return [tokenIndex];
      }
      const rangeStart = Math.min(firstIndex, tokenIndex);
      const rangeEnd = Math.max(lastIndex, tokenIndex);
      return Array.from({ length: rangeEnd - rangeStart + 1 }, (_, offset) => rangeStart + offset);
    });
  };

  const startPhraseSelection = (): void => {
    setSelectingPhrase(true);
    setSelectedTokenIndexes([]);
    setPhraseError("");
    setPendingPhraseAdd(null);
  };

  const cancelPhraseSelection = (): void => {
    setSelectingPhrase(false);
    setSelectedTokenIndexes([]);
    setPhraseError("");
    setPendingPhraseAdd(null);
  };

  const prepareSelectedPhrase = async (): Promise<void> => {
    if (selectedTokenIndexes.length < 2) {
      return;
    }
    const selectedTargetText = selectedPhraseTargetText();
    if (!selectedTargetText) {
      return;
    }
    setPhraseStatus("saving");
    setPhraseError("");
    try {
      const result = await quickAddPhraseFromConversation(
        "",
        selectedTargetText,
        sourceLanguage,
        targetLanguage,
        true,
        dialogId,
        turnIndex,
        sourceText,
        targetText,
      );
      setPendingPhraseAdd({
        sourceText: result.source_text || "",
        targetText: result.target_text || selectedTargetText,
      });
      setPhraseStatus("idle");
    } catch (error) {
      setPhraseStatus("error");
      setPhraseError(error instanceof Error && error.message ? error.message : t("newItem.sentenceAddError"));
    }
  };

  const addSelectedPhrase = async (): Promise<void> => {
    if (!pendingPhraseAdd?.targetText) {
      return;
    }
    setPhraseStatus("saving");
    setPhraseError("");
    try {
      const result = await quickAddPhraseFromConversation(
        pendingPhraseAdd.sourceText,
        pendingPhraseAdd.targetText,
        sourceLanguage,
        targetLanguage,
        false,
        dialogId,
        turnIndex,
        sourceText,
        targetText,
      );
      if (result.id && onOpenItem) {
        await onOpenItem(result.id);
      }
      setPhraseStatus(result.created ? "added" : "exists");
      setSelectingPhrase(false);
      setSelectedTokenIndexes([]);
      setPendingPhraseAdd(null);
    } catch (error) {
      setPhraseStatus("error");
      setPhraseError(error instanceof Error && error.message ? error.message : t("newItem.sentenceAddError"));
    }
  };

  return (
    <>
      {hideTargetText ? (
        <span className="prompt-audio-placeholder">{t("prompt.audioOnly")}</span>
      ) : (
        <>
          {tokens.map((token, tokenIndex) => {
            const normalized = cleanToken(token);
            if (!normalized) {
              return (
                <span key={`${prefix}-punct-${tokenIndex}`} className="turn-token-wrap">
                  {token}
                  {tokenIndex < tokens.length - 1 ? " " : ""}
                </span>
              );
            }
            const statusKey = `${prefix}-${tokenIndex}`;
            const status = tokenStatus[statusKey] || "idle";
            const selectedClass = selectingPhrase ? selectedPhraseTokenClass(tokenIndex) : "";
            const showHighlight = !!highlightWord && wordMatches?.(token, highlightWord);
            return (
              <span key={statusKey} className="turn-token-wrap">
                <button
                  type="button"
                  className={`turn-token-button ${showHighlight ? "turn-word-highlight" : ""} ${selectedClass}`}
                  onClick={() => {
                    if (selectingPhrase) {
                      togglePhraseSelectionToken(tokenIndex);
                      return;
                    }
                    onTokenClick?.(statusKey, token, tokenIndex);
                  }}
                  disabled={!selectingPhrase && status === "saving"}
                >
                  {token}
                </button>
                {tokenIndex < tokens.length - 1 ? " " : ""}
                {status === "saving" && <span className="turn-token-status">({t("newItem.wordAddSaving")})</span>}
                {status === "added" && <span className="turn-token-status">({t("newItem.wordAddAdded")})</span>}
                {status === "exists" && <span className="turn-token-status">({t("newItem.wordAddExists")})</span>}
                {status === "error" && <span className="turn-token-status">({t("newItem.wordAddError")})</span>}
              </span>
            );
          })}
        </>
      )}
      {!hideTargetText && showPhraseSelection && (
        <>
          <div className="actions turn-action-row">
            {selectingPhrase ? (
              <>
                <button type="button" className="secondary-button" onClick={cancelPhraseSelection} disabled={phraseStatus === "saving"}>
                  {t("dialogs.cancelPhraseSelection")}
                </button>
                <button
                  type="button"
                  onClick={() => void prepareSelectedPhrase()}
                  disabled={selectedTokenIndexes.length < 2 || phraseStatus === "saving"}
                >
                  {phraseStatus === "saving" ? t("newItem.sentenceAddSaving") : t("dialogs.addSelectedPhrase")}
                </button>
              </>
            ) : (
              <button type="button" className="secondary-button" onClick={startPhraseSelection} disabled={phraseStatus === "saving"}>
                {t("dialogs.selectPhraseWords")}
              </button>
            )}
            {phraseStatus === "added" && <span className="turn-token-status">{t("newItem.sentenceAddAdded")}</span>}
            {phraseStatus === "exists" && <span className="turn-token-status">{t("newItem.sentenceAddExists")}</span>}
            {phraseStatus === "error" && <span className="turn-token-status">{phraseError || t("newItem.sentenceAddError")}</span>}
          </div>
          {selectingPhrase && <p className="hint">{t("dialogs.selectedPhraseHint")}</p>}
        </>
      )}
      {pendingPhraseAdd && (
        <div className="blocking-modal-overlay" role="dialog" aria-modal="true">
          <div className="blocking-modal add-word-modal">
            <p className="add-word-modal-title">
              <strong>{t("dialogs.addSelectedPhrase")}</strong>
            </p>
            <p className="hint">{t("dialogs.phraseSelectionConfirmPrompt")}</p>
            <p className="add-word-modal-word">{pendingPhraseAdd.targetText}</p>
            <p className="add-word-modal-meaning">
              {t("newItem.sentenceAddTranslation", { translation: pendingPhraseAdd.sourceText })}
            </p>
            <div className="actions">
              <button type="button" className="secondary-button" onClick={() => setPendingPhraseAdd(null)} disabled={phraseStatus === "saving"}>
                {t("newItem.wordAddCancel")}
              </button>
              <button type="button" onClick={() => void addSelectedPhrase()} disabled={phraseStatus === "saving"}>
                {phraseStatus === "saving" ? t("newItem.sentenceAddSaving") : t("newItem.sentenceAddConfirmButton")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
