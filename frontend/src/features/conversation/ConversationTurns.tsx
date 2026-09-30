import type { RefObject } from "react";

import { useI18n } from "../../i18n";

type VisibilityState = {
  topic: string;
  topicWasRandom: boolean;
  goal: string;
  goalRegenerating: boolean;
  assistantSpeaking: boolean;
};

type TurnActions = {
  regenerateGoal: () => Promise<void>;
};

type Props = {
  historyRef: RefObject<HTMLDivElement>;
  visibility: VisibilityState;
  actions: TurnActions;
};

export default function ConversationTurns({
  historyRef,
  visibility,
  actions,
}: Props): JSX.Element {
  const { t } = useI18n();
  return (
    <div ref={historyRef} className="item-questions-history item-chat-thread item-conversation-history">
      {visibility.topic && (
        <div className="conversation-topic-banner">
          {visibility.topicWasRandom && (
            <p className="conversation-topic-banner-kicker">{t("content.topic.random")}</p>
          )}
          <p className="conversation-topic-banner-title">{visibility.topic}</p>
        </div>
      )}

      {visibility.goal && (
        <div className="conversation-goal-banner">
          <div className="conversation-goal-banner-header">
            <p className="conversation-goal-banner-label">{t("conversation.goalLabel")}</p>
            <button
              type="button"
              className="secondary-button conversation-goal-regenerate"
              onClick={() => void actions.regenerateGoal()}
              disabled={visibility.goalRegenerating || visibility.assistantSpeaking}
            >
              {visibility.goalRegenerating ? t("conversation.goalRegenerating") : t("conversation.goalRegenerate")}
            </button>
          </div>
          <p className="conversation-goal-banner-text">{visibility.goal}</p>
        </div>
      )}

    </div>
  );
}
