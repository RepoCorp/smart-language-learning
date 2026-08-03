import type { RefObject } from "react";

import { useI18n } from "../../i18n";
import type { ContentItemConversationResponse } from "../../types";

type VisibilityState = {
  topic: string;
  topicWasRandom: boolean;
  goal: string;
  goalRegenerating: boolean;
  assistantHintsRemaining: number;
  assistantRevealUsed: Record<number, boolean>;
  assistantSpeaking: boolean;
  translationVisible: Record<number, boolean>;
};

type TurnActions = {
  renderTargetLineWithWordLinks: (args: {
    baseKey: string;
    sourceText: string;
    targetText: string;
    disableWordClicks?: boolean;
  }) => JSX.Element;
  showAssistantTurnHint: (index: number) => void;
  regenerateGoal: () => Promise<void>;
};

type Props = {
  historyRef: RefObject<HTMLDivElement>;
  visibility: VisibilityState;
  actions: TurnActions;
  conversationTurns: ContentItemConversationResponse[];
};

export default function ConversationTurns({
  historyRef,
  visibility,
  actions,
  conversationTurns,
}: Props): JSX.Element {
  const { t } = useI18n();
  const latestTurnIndex = conversationTurns.length - 1;
  const latestTurn = latestTurnIndex >= 0 ? conversationTurns[latestTurnIndex] : null;
  const latestTurnRevealed = latestTurnIndex >= 0 && Boolean(visibility.translationVisible[latestTurnIndex]);
  const canRevealLatestTurn = latestTurnIndex >= 0
    && !visibility.assistantSpeaking
    && !latestTurnRevealed
    && (visibility.assistantHintsRemaining > 0 || visibility.assistantRevealUsed[latestTurnIndex]);

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

      {latestTurn && (
        <div className="conversation-last-turn-help">
          {latestTurnRevealed ? (
            <div className="item-conversation-translation">
              <div className="conversation-turn-helper-target">
                {actions.renderTargetLineWithWordLinks({
                  baseKey: `conversation-assistant-${latestTurnIndex}`,
                  sourceText: latestTurn.assistant_translation_text || "",
                  targetText: latestTurn.assistant_text || "",
                  disableWordClicks: true,
                })}
              </div>
              {Boolean(latestTurn.assistant_translation_text) && (
                <div className="conversation-line-translation">
                  {latestTurn.assistant_translation_text}
                </div>
              )}
            </div>
          ) : (
            <div className="item-chat-message item-chat-assistant">
              <button
                type="button"
                className={`item-chat-bubble item-chat-bubble-button item-chat-bubble-button-latest item-chat-bubble-button-latest-ready${visibility.assistantHintsRemaining < 1 ? " item-chat-bubble-button-latest-empty" : ""}`}
                onClick={() => actions.showAssistantTurnHint(latestTurnIndex)}
                disabled={!canRevealLatestTurn}
              >
                <span className="conversation-last-bubble-hint">
                  <span className="conversation-last-bubble-icon" aria-hidden="true">||</span>
                  <span>
                    {visibility.assistantHintsRemaining > 0
                      ? t("conversation.latestBubbleHint", { count: visibility.assistantHintsRemaining })
                      : t("conversation.latestBubbleHintEmpty")}
                  </span>
                </span>
              </button>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
