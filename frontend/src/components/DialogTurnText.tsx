import { useState, type ReactNode } from "react";

import { useI18n } from "../i18n";
import type { StudyLanguageCode } from "../types";
import { FullScreenLoadingOverlay } from "./BlockingLoadingOverlay";
import { useDialogTurnPhraseSelection } from "./dialogs/useDialogTurnPhraseSelection";
import TargetPhraseText from "./TargetPhraseText";

export type ActionStatus = "idle" | "saving" | "added" | "exists" | "error";

export type WholePhraseSaveAction = {
  onSave: () => void | Promise<void>;
  status?: ActionStatus;
  error?: string;
  disabled?: boolean;
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
  onOpenItem?: (itemId: number) => void | Promise<void>;
  wordMatches?: (token: string, word: string) => boolean;
  showPhraseSelection?: boolean;
  showSavingOverlay?: boolean;
  leadingAction?: ReactNode;
  wholePhraseSaveAction?: WholePhraseSaveAction;
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
  showSavingOverlay = true,
  leadingAction,
  wholePhraseSaveAction,
}: DialogTurnTextProps): JSX.Element {
  const { t } = useI18n();
  const [showSaveChoices, setShowSaveChoices] = useState(false);
  const prefix = statusKeyPrefix || `${dialogId}-${turnIndex}-target`;
  const tokens = lineTokens(targetText);
  const {
    selectingPhrase,
    selectedTokenIndexes,
    phraseStatus,
    phraseError,
    pendingPhraseAdd,
    selectedPhraseTokenClass,
    togglePhraseSelectionToken,
    startPhraseSelection,
    cancelPhraseSelection,
    prepareSelectedPhrase,
    addSelectedPhrase,
    cancelPendingPhraseAdd,
  } = useDialogTurnPhraseSelection({
    dialogId,
    turnIndex,
    sourceText,
    targetText,
    sourceLanguage,
    targetLanguage,
    sentenceAddError: t("newItem.sentenceAddError"),
    onOpenItem,
  });
  const isSaving = phraseStatus === "saving"
    || wholePhraseSaveAction?.status === "saving"
    || Object.values(tokenStatus).includes("saving");
  const wholePhraseLabel = hideTargetText ? t("dialogs.saveSentence") : t("dialogs.saveWholePhrase");

  const chooseWholePhrase = (): void => {
    setShowSaveChoices(false);
    void wholePhraseSaveAction?.onSave();
  };
  const choosePhrasePart = (): void => {
    setShowSaveChoices(false);
    startPhraseSelection();
  };

  return (
    <>
      <div className="dialog-target-line">
        {leadingAction}
        <TargetPhraseText as="span" hideText={hideTargetText} variant="dialog">
          <>
            {tokens.map((token, tokenIndex) => {
              const normalized = cleanToken(token);
              if (!normalized) {
                return <span key={`${prefix}-punct-${tokenIndex}`} className="turn-token-wrap">{token}{tokenIndex < tokens.length - 1 ? " " : ""}</span>;
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
                    onClick={() => selectingPhrase ? togglePhraseSelectionToken(tokenIndex) : onTokenClick?.(statusKey, token, tokenIndex)}
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
        </TargetPhraseText>
      </div>
      {!hideTargetText && <p className="conversation-line">{sourceText}</p>}
      {(wholePhraseSaveAction || (!hideTargetText && showPhraseSelection)) && (
        <>
          <div className="actions turn-action-row">
            {selectingPhrase ? (
              <>
                <button type="button" className="secondary-button" onClick={cancelPhraseSelection} disabled={phraseStatus === "saving"}>
                  {t("dialogs.cancelPhraseSelection")}
                </button>
                <button type="button" onClick={() => void prepareSelectedPhrase(tokens)} disabled={selectedTokenIndexes.length < 2 || phraseStatus === "saving"}>
                  {phraseStatus === "saving" ? t("newItem.sentenceAddSaving") : t("dialogs.addSelectedPhrase")}
                </button>
              </>
            ) : wholePhraseSaveAction && !hideTargetText && showPhraseSelection ? (
              <div className="turn-save-chooser">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowSaveChoices((current) => !current)}
                  disabled={wholePhraseSaveAction.disabled || wholePhraseSaveAction.status === "saving"}
                  aria-expanded={showSaveChoices}
                >
                  {showSaveChoices ? t("newItem.wordAddCancel") : t("dialogs.save")}
                </button>
                {showSaveChoices && (
                  <div className="turn-save-options">
                    <button type="button" onClick={chooseWholePhrase} disabled={wholePhraseSaveAction.disabled || wholePhraseSaveAction.status === "saving"}>
                      {wholePhraseSaveAction.status === "saving" ? t("newItem.sentenceAddSaving") : wholePhraseLabel}
                    </button>
                    <button type="button" className="secondary-button" onClick={choosePhrasePart}>{t("dialogs.savePhrasePart")}</button>
                  </div>
                )}
              </div>
            ) : wholePhraseSaveAction ? (
              <button type="button" className="secondary-button" onClick={chooseWholePhrase} disabled={wholePhraseSaveAction.disabled || wholePhraseSaveAction.status === "saving"}>
                {wholePhraseSaveAction.status === "saving" ? t("newItem.sentenceAddSaving") : wholePhraseLabel}
              </button>
            ) : !hideTargetText && showPhraseSelection ? (
              <button type="button" className="secondary-button" onClick={startPhraseSelection} disabled={phraseStatus === "saving"}>{t("dialogs.selectPhraseWords")}</button>
            ) : null}
            {wholePhraseSaveAction?.status === "added" && <span className="turn-token-status">{t("newItem.sentenceAddAdded")}</span>}
            {wholePhraseSaveAction?.status === "exists" && <span className="turn-token-status">{t("newItem.sentenceAddExists")}</span>}
            {wholePhraseSaveAction?.status === "error" && <span className="turn-token-status">{wholePhraseSaveAction.error || t("newItem.sentenceAddError")}</span>}
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
            <p className="add-word-modal-title"><strong>{t("dialogs.addSelectedPhrase")}</strong></p>
            <p className="hint">{t("dialogs.phraseSelectionConfirmPrompt")}</p>
            <p className="add-word-modal-word">{pendingPhraseAdd.targetText}</p>
            <p className="add-word-modal-meaning">{t("newItem.sentenceAddTranslation", { translation: pendingPhraseAdd.sourceText })}</p>
            <div className="actions">
              <button type="button" className="secondary-button" onClick={cancelPendingPhraseAdd} disabled={phraseStatus === "saving"}>{t("newItem.wordAddCancel")}</button>
              <button type="button" onClick={() => void addSelectedPhrase()} disabled={phraseStatus === "saving"}>
                {phraseStatus === "saving" ? t("newItem.sentenceAddSaving") : t("newItem.sentenceAddConfirmButton")}
              </button>
            </div>
          </div>
        </div>
      )}
      {showSavingOverlay && <FullScreenLoadingOverlay loading={isSaving} message={t("loading.savingItem")} />}
    </>
  );
}
