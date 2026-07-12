import type { ReactNode } from "react";

import { useI18n } from "../../i18n";
import type { ConversationResponseLevel, ConversationSpeechSpeed } from "./conversationTransportTypes";

type SummaryProps = {
  topic: string;
  role: string;
  goalDifficultyLabel: string;
  goal: string;
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
  transportHint: string;
};

type ControlProps = {
  helpLoading: boolean;
  onEndConversation: () => void;
  onOpenHelp: () => void;
  onResponseLevelChange: (level: ConversationResponseLevel) => void;
  onSpeechSpeedChange: (speed: ConversationSpeechSpeed) => void;
  onTogglePaused: () => void;
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
      </div>

      {children}

      {status.conversationRecording && (
        <p className="item-conversation-listening">
          <span className="item-conversation-listening-dot" />
          {t("newItem.conversationListening", { seconds: status.conversationRecordingSeconds })}
        </p>
      )}
      {status.conversationPaused && !status.conversationRecording && <p className="hint">{t("conversation.paused")}</p>}
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
        <button
          type="button"
          className="secondary-button"
          onClick={controls.onTogglePaused}
          disabled={status.conversationLoading || status.conversationRealtimeConnecting}
        >
          {status.conversationPaused ? t("conversation.resume") : t("conversation.pause")}
        </button>
      </div>
      {status.conversationRecording && (
        <div className="actions">
          <button
            type="button"
            className="dangerous-action-button"
            onClick={controls.onStopRecording}
            disabled={!status.canSendResponse || status.conversationLoading || status.conversationRealtimeConnecting}
          >
            {t("newItem.conversationStopRecording")}
          </button>
        </div>
      )}
    </>
  );
}
