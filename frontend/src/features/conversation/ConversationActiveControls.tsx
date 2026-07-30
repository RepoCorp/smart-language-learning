import type { ReactNode } from "react";

import { useI18n } from "../../i18n";
import type { ConversationResponseLevel, ConversationSpeechSpeed } from "./conversationTransportTypes";

type SummaryProps = {
  role: string;
};

type StatusProps = {
  canSendResponse: boolean;
  conversationPaused: boolean;
  conversationRecording: boolean;
  conversationRecordingSeconds: number;
  conversationLoading: boolean;
  conversationRealtimeConnecting: boolean;
  responseLevel: ConversationResponseLevel;
  showResponseLevelControl: boolean;
  showSpeechSpeedControl: boolean;
  speechSpeed: ConversationSpeechSpeed;
};

type ControlProps = {
  helpLoading: boolean;
  onEndConversation: () => void;
  onOpenHelp: () => void;
  onPause: () => void;
  onResponseLevelChange: (level: ConversationResponseLevel) => void;
  onSpeechSpeedChange: (speed: ConversationSpeechSpeed) => void;
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
                className="dangerous-action-button"
                onClick={controls.onStopRecording}
                disabled={!status.canSendResponse || status.conversationLoading || status.conversationRealtimeConnecting}
              >
                {t("newItem.conversationStopRecording")}
              </button>
            </div>
          ) : null}
          <div className="actions conversation-primary-actions">
            {!status.conversationRecording && (
              <button
                type="button"
                onClick={controls.onStartRecording}
                disabled={status.conversationLoading || status.conversationRealtimeConnecting || controls.helpLoading}
              >
                {t("newItem.conversationStartRecording")}
              </button>
            )}
            {!status.conversationPaused && (
              <button
                type="button"
                className="secondary-button"
                onClick={controls.onPause}
                disabled={status.conversationLoading || status.conversationRealtimeConnecting}
              >
                {t("conversation.pause")}
              </button>
            )}
          </div>
          {status.conversationPaused && !status.conversationRecording && <p className="hint">{t("conversation.paused")}</p>}
          {status.conversationLoading && <p className="hint">{t("newItem.conversationProcessing")}</p>}
          {status.conversationRealtimeConnecting && <p className="hint">{t("conversation.realtimeConnecting")}</p>}
        </div>

        <details className="conversation-secondary-controls">
          <summary className="conversation-secondary-summary">
            <span className="conversation-secondary-summary-copy">
              <span className="conversation-secondary-summary-title">
                <span className="conversation-secondary-summary-caret" aria-hidden="true">▾</span>
                <span>{t("conversation.moreControls")}</span>
              </span>
            </span>
            {summary.role ? <span className="conversation-secondary-summary-meta">{summary.role}</span> : null}
          </summary>
          <div className="actions conversation-support-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={controls.onOpenHelp}
              disabled={status.conversationLoading || status.conversationRealtimeConnecting || controls.helpLoading}
            >
              {t("conversation.helpOpen")}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={controls.onEndConversation}
              disabled={status.conversationLoading || status.conversationRealtimeConnecting}
            >
              {t("conversation.end")}
            </button>
          </div>
          {status.showSpeechSpeedControl && (
            <div className="conversation-speed-controls">
              <label className="prompt conversation-speed-label">{t("conversation.speedLabel")}</label>
              <div className="exercise-audio-mode">
                <label className={`exercise-radio-option ${status.speechSpeed === "normal" ? "exercise-radio-option-selected" : ""}`}>
                  <input
                    type="radio"
                    name="conversation-speech-speed"
                    checked={status.speechSpeed === "normal"}
                    onChange={() => controls.onSpeechSpeedChange("normal")}
                    disabled={status.conversationRealtimeConnecting}
                  />
                  <span>{t("conversation.speedNormal")}</span>
                </label>
                <label className={`exercise-radio-option ${status.speechSpeed === "slow" ? "exercise-radio-option-selected" : ""}`}>
                  <input
                    type="radio"
                    name="conversation-speech-speed"
                    checked={status.speechSpeed === "slow"}
                    onChange={() => controls.onSpeechSpeedChange("slow")}
                    disabled={status.conversationRealtimeConnecting}
                  />
                  <span>{t("conversation.speedSlow")}</span>
                </label>
                <label className={`exercise-radio-option ${status.speechSpeed === "super_slow" ? "exercise-radio-option-selected" : ""}`}>
                  <input
                    type="radio"
                    name="conversation-speech-speed"
                    checked={status.speechSpeed === "super_slow"}
                    onChange={() => controls.onSpeechSpeedChange("super_slow")}
                    disabled={status.conversationRealtimeConnecting}
                  />
                  <span>{t("conversation.speedSuperSlow")}</span>
                </label>
              </div>
            </div>
          )}
          {status.showResponseLevelControl && (
            <div className="conversation-speed-controls">
              <label className="prompt conversation-speed-label">{t("conversation.levelLabel")}</label>
              <div className="exercise-audio-mode">
                <label className={`exercise-radio-option ${status.responseLevel === "A1" ? "exercise-radio-option-selected" : ""}`}>
                  <input
                    type="radio"
                    name="conversation-response-level"
                    checked={status.responseLevel === "A1"}
                    onChange={() => controls.onResponseLevelChange("A1")}
                    disabled={status.conversationRealtimeConnecting}
                  />
                  <span>{t("conversation.levelA1")}</span>
                </label>
                <label className={`exercise-radio-option ${status.responseLevel === "A2" ? "exercise-radio-option-selected" : ""}`}>
                  <input
                    type="radio"
                    name="conversation-response-level"
                    checked={status.responseLevel === "A2"}
                    onChange={() => controls.onResponseLevelChange("A2")}
                    disabled={status.conversationRealtimeConnecting}
                  />
                  <span>{t("conversation.levelA2")}</span>
                </label>
                <label className={`exercise-radio-option ${status.responseLevel === "B1" ? "exercise-radio-option-selected" : ""}`}>
                  <input
                    type="radio"
                    name="conversation-response-level"
                    checked={status.responseLevel === "B1"}
                    onChange={() => controls.onResponseLevelChange("B1")}
                    disabled={status.conversationRealtimeConnecting}
                  />
                  <span>{t("conversation.levelB1")}</span>
                </label>
              </div>
            </div>
          )}
        </details>
      </div>
    </>
  );
}
