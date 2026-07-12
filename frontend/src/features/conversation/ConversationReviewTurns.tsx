import { useI18n } from "../../i18n";
import type { ContentDialogRecord } from "../../types";

export type SentenceActionStatus = "idle" | "saving" | "added" | "exists" | "error" | "missing_source";

type Props = {
  dialog: ContentDialogRecord;
  renderTargetLineWithWordLinks: (args: {
    baseKey: string;
    sourceText: string;
    targetText: string;
    dialogId?: number;
    turnIndex?: number;
    disableWordClicks?: boolean;
  }) => JSX.Element;
  requestAddSentenceFromConversation: (key: string, sourceTextRaw: string, targetTextRaw: string, dialogId?: number, turnIndex?: number) => Promise<void>;
  sentenceActionStatus: Record<string, SentenceActionStatus>;
  readOnly?: boolean;
  originalUserTexts?: Record<number, string>;
  correctedUserTexts?: Record<number, string>;
};

export default function ConversationReviewTurns({
  dialog,
  renderTargetLineWithWordLinks,
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
              {renderTargetLineWithWordLinks({
                baseKey: `conversation-review-${dialog.dialog_id}-${index}`,
                sourceText: turn.source_text,
                targetText: turn.target_text,
                dialogId: dialog.dialog_id,
                turnIndex: index,
                disableWordClicks: readOnly,
              })}
            </div>
            {Boolean(turn.source_text) && (
              <p className="conversation-line conversation-line-translation">{turn.source_text}</p>
            )}
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
