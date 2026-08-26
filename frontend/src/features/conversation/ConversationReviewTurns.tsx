import { useI18n } from "../../i18n";
import type { ContentDialogRecord, StudyLanguageCode } from "../../types";
import DialogTurnText, { type ActionStatus } from "../../components/DialogTurnText";
import FormattedModelText from "../../components/FormattedModelText";
import type { ConversationReviewErrorInfo } from "./useConversationReviewErrorInfo";

export type SentenceActionStatus = "idle" | "saving" | "added" | "exists" | "error" | "missing_source";

type Props = {
  dialog: ContentDialogRecord;
  sourceLanguage: StudyLanguageCode;
  targetLanguage: StudyLanguageCode;
  wordActionStatus: Record<string, "idle" | "saving" | "added" | "exists" | "error">;
  requestAddWordFromConversation: (
    key: string,
    sourceText: string,
    targetText: string,
    targetToken: string,
    dialogId?: number,
    turnIndex?: number,
  ) => Promise<void>;
  requestAddSentenceFromConversation: (key: string, sourceTextRaw: string, targetTextRaw: string, dialogId?: number, turnIndex?: number) => Promise<void>;
  sentenceActionStatus: Record<string, SentenceActionStatus>;
  readOnly?: boolean;
  originalUserTexts?: Record<number, string>;
  correctedUserTexts?: Record<number, string>;
  naturalUserAlternatives?: Record<number, { target: string; source: string }>;
  errorInfoByTurn?: Record<number, ConversationReviewErrorInfo>;
  onRequestErrorInfo?: (turnIndex: number, originalText: string, correctedText: string) => Promise<void>;
  onAddErrorExercises?: (turnIndex: number) => Promise<void>;
};

export default function ConversationReviewTurns({
  dialog,
  sourceLanguage,
  targetLanguage,
  wordActionStatus,
  requestAddWordFromConversation,
  requestAddSentenceFromConversation,
  sentenceActionStatus,
  readOnly = false,
  originalUserTexts = {},
  correctedUserTexts = {},
  naturalUserAlternatives = {},
  errorInfoByTurn = {},
  onRequestErrorInfo,
  onAddErrorExercises,
}: Props): JSX.Element {
  const { t } = useI18n();

  return (
    <div className="conversation-review-list">
      {dialog.turns.map((turn, index) => {
        const speaker = turn.speaker === "b" ? "assistant" : "user";
        const phraseKey = `conversation-review-phrase-${dialog.dialog_id}-${index}`;
        const phraseStatus = sentenceActionStatus[phraseKey] || "idle";
        const wholePhraseStatus: ActionStatus = phraseStatus === "missing_source" ? "error" : phraseStatus;
        const naturalAlternative = naturalUserAlternatives[index];
        const originalText = originalUserTexts[index]?.trim() || "";
        const hasCorrection = speaker === "user" && Boolean(originalText) && originalText !== turn.target_text.trim();
        const errorInfo = errorInfoByTurn[index];
        const naturalPhraseKey = `conversation-review-natural-${dialog.dialog_id}-${index}`;
        const naturalPhraseStatus = sentenceActionStatus[naturalPhraseKey] || "idle";
        return (
          <div
            key={`${dialog.dialog_id}-${index}`}
            className={`conversation-review-entry ${speaker === "assistant" ? "conversation-review-entry-assistant" : "conversation-review-entry-user"}`}
          >
            <p className="conversation-review-speaker">
              {speaker === "assistant" ? t("newItem.conversationLabelTutor") : t("newItem.conversationLabelYou")}
            </p>
            <div className="conversation-review-target">
              <DialogTurnText
                dialogId={dialog.dialog_id}
                turnIndex={index}
                sourceText={turn.source_text}
                targetText={turn.target_text}
                sourceLanguage={sourceLanguage}
                targetLanguage={targetLanguage}
                tokenStatus={wordActionStatus}
                statusKeyPrefix={`conversation-review-${dialog.dialog_id}-${index}-target`}
                disableWordClicks={readOnly}
                onTokenClick={(statusKey, token) => {
                  if (readOnly) {
                    return;
                  }
                  void requestAddWordFromConversation(
                    statusKey,
                    turn.source_text,
                    turn.target_text,
                    token,
                    dialog.dialog_id,
                    index,
                  );
                }}
                showPhraseSelection={!readOnly}
                wholePhraseSaveAction={!readOnly ? {
                  onSave: () => requestAddSentenceFromConversation(
                    phraseKey,
                    turn.source_text,
                    turn.target_text,
                    dialog.dialog_id,
                    index,
                  ),
                  status: wholePhraseStatus,
                  error: phraseStatus === "missing_source" ? t("newItem.sentenceAddMissingSource") : "",
                } : undefined}
              />
            </div>
            {hasCorrection && (
              <>
                <p className="conversation-review-original">
                  <strong>{t("conversation.helpYouSaid")}</strong> {originalText}
                </p>
                {onRequestErrorInfo && (
                  <div className="conversation-review-error-info">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => void onRequestErrorInfo(index, originalText, turn.target_text)}
                      disabled={errorInfo?.loading}
                    >
                      {errorInfo?.loading ? t("newItem.questionsLoading") : t("strategies.grammar.askAboutRule")}
                    </button>
                    {errorInfo?.text && (
                      <>
                        <FormattedModelText text={errorInfo.text} className="conversation-review-error-text" />
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => void onAddErrorExercises?.(index)}
                          disabled={!onAddErrorExercises || errorInfo.addingExercises || errorInfo.exercisesAdded}
                        >
                          {errorInfo.addingExercises ? "Adding..." : errorInfo.exercisesAdded ? "Added to exercises" : "Add to exercises"}
                        </button>
                      </>
                    )}
                    {errorInfo?.error && <small className="error">{errorInfo.error}</small>}
                  </div>
                )}
              </>
            )}
            {speaker === "user" && correctedUserTexts[index] && correctedUserTexts[index].trim() !== turn.target_text.trim() && (
              <p className="conversation-review-corrected">
                <strong>{t("conversation.correctedLabel")}</strong> {correctedUserTexts[index]}
              </p>
            )}
            {speaker === "user" && naturalAlternative && (
              <div className="conversation-review-natural">
                <strong>{t("conversation.moreNatural")}</strong>
                <span>{naturalAlternative.target}</span>
                {naturalAlternative.source && (
                  <small>{naturalAlternative.source}</small>
                )}
                {!readOnly && (
                  <button
                    type="button"
                    className="secondary-button conversation-review-natural-save"
                    onClick={() => void requestAddSentenceFromConversation(
                      naturalPhraseKey,
                      naturalAlternative.source,
                      naturalAlternative.target,
                      dialog.dialog_id,
                      index,
                    )}
                    disabled={naturalPhraseStatus === "saving"}
                  >
                    {naturalPhraseStatus === "saving" ? t("newItem.sentenceAddSaving") : t("newItem.sentenceAddConfirmButton")}
                  </button>
                )}
                {naturalPhraseStatus === "added" && <small>{t("newItem.wordAddAdded")}</small>}
                {naturalPhraseStatus === "exists" && <small>{t("newItem.wordAddExists")}</small>}
                {naturalPhraseStatus === "error" && <small>{t("newItem.sentenceAddError")}</small>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
