import { useI18n } from "../../i18n";
import type { ContentDialogRecord, StudyLanguageCode } from "../../types";
import DialogTurnText, { type ActionStatus } from "../../components/DialogTurnText";

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
}: Props): JSX.Element {
  const { t } = useI18n();

  return (
    <div className="conversation-review-list">
      {dialog.turns.map((turn, index) => {
        const speaker = turn.speaker === "b" ? "assistant" : "user";
        const phraseKey = `conversation-review-phrase-${dialog.dialog_id}-${index}`;
        const phraseStatus = sentenceActionStatus[phraseKey] || "idle";
        const wholePhraseStatus: ActionStatus = phraseStatus === "missing_source" ? "error" : phraseStatus;
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
            {speaker === "user" && naturalUserAlternatives[index] && (
              <div className="conversation-review-natural">
                <strong>{t("conversation.moreNatural")}</strong>
                <span>{naturalUserAlternatives[index].target}</span>
                {naturalUserAlternatives[index].source && (
                  <small>{naturalUserAlternatives[index].source}</small>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
