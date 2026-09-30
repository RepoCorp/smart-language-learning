import { useI18n, type MessageKey } from "../../i18n";
import type { ConversationResponseLevel, ConversationSpeechSpeed } from "./conversationTransportTypes";

type Props = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  status: {
    conversationPaused: boolean;
    conversationLoading: boolean;
    conversationRealtimeConnecting: boolean;
    responseLevel: ConversationResponseLevel;
    speechSpeed: ConversationSpeechSpeed;
  };
  controls: {
    onPause: () => void;
    onResponseLevelChange: (level: ConversationResponseLevel) => void;
    onSpeechSpeedChange: (speed: ConversationSpeechSpeed) => void;
  };
};
const speeds: { value: ConversationSpeechSpeed; label: MessageKey }[] = [
  { value: "normal", label: "conversation.speedNormal" },
  { value: "slow", label: "conversation.speedSlow" },
  { value: "super_slow", label: "conversation.speedSuperSlow" },
];
const levels: { value: ConversationResponseLevel; label: MessageKey }[] = [
  { value: "A0", label: "study.absoluteBeginner" },
  { value: "A1", label: "conversation.levelA1" },
  { value: "A2", label: "conversation.levelA2" },
  { value: "B1", label: "conversation.levelB1" },
];

export default function ConversationMoreControls({ status, controls, open, onOpenChange }: Props): JSX.Element {
  const { t } = useI18n();
  const disabled = status.conversationLoading || status.conversationRealtimeConnecting;
  return (
    <details className="conversation-secondary-controls" open={open} onToggle={event => {
      if (event.currentTarget.open && !status.conversationPaused) controls.onPause();
    }}>
      <summary className="conversation-secondary-summary" onClick={event => {
        if (onOpenChange) {
          event.preventDefault();
          onOpenChange(!open);
        }
      }}>
        <span className="conversation-secondary-summary-copy">
          <span className="conversation-secondary-summary-title">{t("conversation.moreControls")}</span>
        </span>
        <span className="conversation-secondary-summary-caret" aria-hidden="true">▾</span>
      </summary>
      <div className="conversation-speed-controls">
        <p className="prompt conversation-speed-label">{t("conversation.speedLabel")}</p>
        <div className="exercise-audio-mode conversation-speed-options" role="radiogroup" aria-label={t("conversation.speedLabel")}>
          {speeds.map(({ value, label }) => (
            <label key={value} className={`exercise-radio-option ${status.speechSpeed === value ? "exercise-radio-option-selected" : ""}`}>
              <input type="radio" name="conversation-speech-speed" checked={status.speechSpeed === value}
                onChange={() => controls.onSpeechSpeedChange(value)} disabled={disabled} />
              <span>{t(label)}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="conversation-speed-controls">
        <p className="prompt conversation-speed-label">{t("conversation.levelLabel")}</p>
        <div className="exercise-audio-mode" role="radiogroup" aria-label={t("conversation.levelLabel")}>
          {levels.map(({ value, label }) => (
            <label key={value} className={`exercise-radio-option ${status.responseLevel === value ? "exercise-radio-option-selected" : ""}`}>
              <input type="radio" name="conversation-response-level" checked={status.responseLevel === value}
                onChange={() => controls.onResponseLevelChange(value)} disabled={disabled} />
              <span>{t(label)}</span>
            </label>
          ))}
        </div>
      </div>
    </details>
  );
}
