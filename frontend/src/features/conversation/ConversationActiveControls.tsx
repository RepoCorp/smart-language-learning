import type { ReactNode } from "react";

import { useI18n } from "../../i18n";

type SummaryProps = {
  topic: string;
  role: string;
  goalDifficultyLabel: string;
  goal: string;
};

type StatusProps = {
  conversationRecording: boolean;
  conversationRecordingSeconds: number;
  conversationLoading: boolean;
  conversationRealtimeConnecting: boolean;
  transportHint: string;
};

type ControlProps = {
  helpLoading: boolean;
  onEndConversation: () => void;
  onOpenHelp: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
};

type Props = {
  summary: SummaryProps;
  status: StatusProps;
  controls: ControlProps;
  children?: ReactNode;
};

export default function ConversationActiveControls({
  summary,
  status,
  controls,
  children,
}: Props): JSX.Element {
  const { t } = useI18n();

  return (
    <>
      <div className="content-form-section conversation-goal-card">
        <p className="item-chat-meta"><strong>{t("conversation.topicLabel")}</strong> {summary.topic}</p>
        {summary.role && <p className="item-chat-meta"><strong>{t("conversation.roleLabel")}</strong> {summary.role}</p>}
        <p className="item-chat-meta"><strong>{t("conversation.goalDifficultyLabel")}</strong> {summary.goalDifficultyLabel}</p>
        <p className="item-chat-meta"><strong>{t("conversation.goalLabel")}</strong> {summary.goal}</p>
        <div className="actions">
          <button
            type="button"
            className="secondary-button"
            onClick={controls.onEndConversation}
            disabled={status.conversationLoading || status.conversationRealtimeConnecting}
          >
            {t("conversation.end")}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={controls.onOpenHelp}
            disabled={status.conversationLoading || status.conversationRealtimeConnecting || controls.helpLoading}
          >
            {t("conversation.helpOpen")}
          </button>
        </div>
        <p className="hint">{status.transportHint}</p>
      </div>

      {children}

      {status.conversationRecording && (
        <p className="item-conversation-listening">
          <span className="item-conversation-listening-dot" />
          {t("newItem.conversationListening", { seconds: status.conversationRecordingSeconds })}
        </p>
      )}
      {status.conversationLoading && <p className="hint">{t("newItem.conversationProcessing")}</p>}
      {status.conversationRealtimeConnecting && <p className="hint">{t("conversation.realtimeConnecting")}</p>}

      <div className="actions">
        {!status.conversationRecording && (
          <button
            type="button"
            onClick={controls.onStartRecording}
            disabled={status.conversationLoading || status.conversationRealtimeConnecting || controls.helpLoading}
          >
            {t("newItem.conversationStartRecording")}
          </button>
        )}
        {status.conversationRecording && (
          <button
            type="button"
            onClick={controls.onStopRecording}
            disabled={status.conversationLoading || status.conversationRealtimeConnecting}
          >
            {t("newItem.conversationStopRecording")}
          </button>
        )}
      </div>
    </>
  );
}
