import type { ReactNode } from "react";
import ConversationMoreControls from "./ConversationMoreControls";

import { useI18n } from "../../i18n";
import DialogActionIcon from "../../components/DialogActionIcon";
import type { ConversationResponseLevel, ConversationSpeechSpeed } from "./conversationTransportTypes";

type StatusProps = {
  canSendResponse: boolean;
  conversationPaused: boolean;
  conversationRecording: boolean;
  conversationRecordingSeconds: number;
  conversationLoading: boolean;
  conversationRealtimeConnecting: boolean;
  responseLevel: ConversationResponseLevel;
  speechSpeed: ConversationSpeechSpeed;
};

type ControlProps = {
  onEndConversation: () => void;
  onPause: () => void;
  onResponseLevelChange: (level: ConversationResponseLevel) => void;
  onSpeechSpeedChange: (speed: ConversationSpeechSpeed) => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
};

type Props = {
  status: StatusProps;
  controls: ControlProps;
  children?: ReactNode;
};

export default function ConversationActiveControls({
  status,
  controls,
  children,
}: Props): JSX.Element {
  const { t } = useI18n();
  const showStartRecording = !status.conversationRecording && status.conversationPaused;
  const showPause = !status.conversationPaused;

  return (
    <>
      {children}

      <div className="content-form-section conversation-controls-card">
        <div className="conversation-primary-controls">
          {status.conversationRecording ? (
            <div className="conversation-listening-row">
              <p className="item-conversation-listening">
                <span className="item-conversation-listening-dot" />
                {t("newItem.conversationListening", { seconds: status.conversationRecordingSeconds })}
              </p>
              <button
                type="button"
                className="conversation-send-message-button"
                onClick={controls.onStopRecording}
                disabled={!status.canSendResponse || status.conversationLoading || status.conversationRealtimeConnecting}
                aria-label={t("newItem.conversationStopRecording")}
                title={t("newItem.conversationStopRecording")}
              >
                <DialogActionIcon name="send" />
              </button>
            </div>
          ) : null}
          <div className="actions conversation-primary-actions">
            {showStartRecording && (
              <button
                type="button"
                onClick={controls.onStartRecording}
                disabled={status.conversationLoading || status.conversationRealtimeConnecting}
              >
                {t("newItem.conversationStartRecording")}
              </button>
            )}
            <div className="conversation-primary-secondary-actions">
              {showPause && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={controls.onPause}
                  disabled={status.conversationLoading || status.conversationRealtimeConnecting}
                >
                  {t("conversation.pause")}
                </button>
              )}
              <button
                type="button"
                className="dangerous-action-button"
                onClick={controls.onEndConversation}
                disabled={status.conversationLoading || status.conversationRealtimeConnecting}
              >
                {t("conversation.end")}
              </button>
            </div>
          </div>
          {status.conversationPaused && !status.conversationRecording && <p className="hint">{t("conversation.paused")}</p>}
          {status.conversationLoading && <p className="hint">{t("newItem.conversationProcessing")}</p>}
          {status.conversationRealtimeConnecting && <p className="hint">{t("conversation.realtimeConnecting")}</p>}
        </div>

        <ConversationMoreControls status={status} controls={controls} />
      </div>
    </>
  );
}
