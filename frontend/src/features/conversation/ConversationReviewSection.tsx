import { useI18n } from "../../i18n";
import type { ContentDialogRecord } from "../../types";
import ConversationReviewTurns, { type SentenceActionStatus } from "./ConversationReviewTurns";

type Props = {
  topic: string;
  role: string;
  goal: string;
  goalDifficultyLabel: string;
  heading: string;
  description: string;
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
  originalUserTexts?: Record<number, string>;
  correctedUserTexts?: Record<number, string>;
  readOnly?: boolean;
  loading?: boolean;
  loadingMessage?: string;
  primaryAction?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    secondary?: boolean;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    secondary?: boolean;
  };
  error?: string;
};

export default function ConversationReviewSection({
  topic,
  role,
  goal,
  goalDifficultyLabel,
  heading,
  description,
  dialog,
  renderTargetLineWithWordLinks,
  requestAddSentenceFromConversation,
  sentenceActionStatus,
  originalUserTexts,
  correctedUserTexts,
  readOnly = false,
  loading = false,
  loadingMessage = "",
  primaryAction,
  secondaryAction,
  error = "",
}: Props): JSX.Element {
  const { t } = useI18n();

  return (
    <div className="content-form-section conversation-review-card">
      <p className="item-chat-meta"><strong>{t("conversation.topicLabel")}</strong> {topic}</p>
      {role && <p className="item-chat-meta"><strong>{t("conversation.roleLabel")}</strong> {role}</p>}
      <p className="item-chat-meta"><strong>{t("conversation.goalDifficultyLabel")}</strong> {goalDifficultyLabel}</p>
      <p className="item-chat-meta"><strong>{t("conversation.goalLabel")}</strong> {goal}</p>
      <p className="conversation-review-heading">{heading}</p>
      <p className="hint">{description}</p>
      <ConversationReviewTurns
        dialog={dialog}
        renderTargetLineWithWordLinks={renderTargetLineWithWordLinks}
        requestAddSentenceFromConversation={requestAddSentenceFromConversation}
        sentenceActionStatus={sentenceActionStatus}
        readOnly={readOnly}
        originalUserTexts={originalUserTexts}
        correctedUserTexts={correctedUserTexts}
      />
      {loading && loadingMessage && <p className="hint">{loadingMessage}</p>}
      {(primaryAction || secondaryAction) && (
        <div className="actions">
          {primaryAction && (
            <button
              type="button"
              className={primaryAction.secondary ? "secondary-button" : undefined}
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
            >
              {primaryAction.label}
            </button>
          )}
          {secondaryAction && (
            <button
              type="button"
              className={secondaryAction.secondary ? "secondary-button" : undefined}
              onClick={secondaryAction.onClick}
              disabled={secondaryAction.disabled}
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
