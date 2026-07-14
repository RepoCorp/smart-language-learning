import { useI18n } from "../../i18n";
import type { ContentDialogRecord, StudyLanguageCode } from "../../types";
import DialogTurnText from "../../components/DialogTurnText";

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
}: Props): JSX.Element {
  const { t } = useI18n();

  return (
    <div className="conversation-review-list">
      {dialog.turns.map((turn, index) => {
        const speaker = turn.speaker === "b" ? "assistant" : "user";
        const phraseKey = `conversation-review-phrase-${dialog.dialog_id}-${index}`;
        const phraseStatus = sentenceActionStatus[phraseKey] || "idle";
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
                extraActions={!readOnly ? (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => void requestAddSentenceFromConversation(phraseKey, turn.source_text, turn.target_text, dialog.dialog_id, index)}
                    disabled={phraseStatus === "saving"}
                  >
                    {t("newItem.sentenceAddButton")}
                  </button>
                ) : undefined}
              />
            </div>
            {speaker === "user" && originalUserTexts[index] && originalUserTexts[index].trim() !== turn.target_text.trim() && (
              <p className="conversation-review-original">
                <strong>{t("conversation.helpYouSaid")}</strong> {originalUserTexts[index]}
              </p>
            )}
            {speaker === "user" && correctedUserTexts[index] && correctedUserTexts[index].trim() !== turn.target_text.trim() && (
              <p className="conversation-review-corrected">
                <strong>{t("conversation.correctedLabel")}</strong> {correctedUserTexts[index]}
              </p>
            )}
            {!readOnly && (
              <div className="actions turn-action-row">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => void requestAddSentenceFromConversation(phraseKey, turn.source_text, turn.target_text, dialog.dialog_id, index)}
                  disabled={phraseStatus === "saving"}
                >
                  {t("newItem.sentenceAddButton")}
                </button>
                {phraseStatus === "saving" && <span className="turn-token-status">{t("newItem.sentenceAddSaving")}</span>}
                {phraseStatus === "added" && <span className="turn-token-status">{t("newItem.sentenceAddAdded")}</span>}
                {phraseStatus === "exists" && <span className="turn-token-status">{t("newItem.sentenceAddExists")}</span>}
                {phraseStatus === "missing_source" && <span className="turn-token-status">{t("newItem.sentenceAddMissingSource")}</span>}
                {phraseStatus === "error" && <span className="turn-token-status">{t("newItem.sentenceAddError")}</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
