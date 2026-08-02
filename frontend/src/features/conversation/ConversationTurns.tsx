import type { RefObject } from "react";

import { useI18n } from "../../i18n";
import type { ContentItemConversationResponse } from "../../types";

type ConversationTurn = ContentItemConversationResponse;

type SentenceActionStatus = "idle" | "saving" | "added" | "exists" | "error" | "missing_source";

type OpeningState = {
  text: string;
  translation: string;
  audioUrl: string;
  showTranslation: boolean;
};

type DisplayState = {
  hideSourceText: boolean;
  sourceLanguageLabel: string;
  pendingUserTurn: boolean;
  pendingAssistantText: string;
};

type VisibilityState = {
  topic: string;
  topicWasRandom: boolean;
  goal: string;
  goalRegenerating: boolean;
  assistantHintsRemaining: number;
  assistantRevealUsed: Record<number, boolean>;
  assistantSpeaking: boolean;
  translationVisible: Record<number, boolean>;
  correctionVisible: Record<number, boolean>;
  userTranslationVisible: Record<number, boolean>;
  userTranslationLoading: Record<number, boolean>;
  userCorrectionLoading: Record<number, boolean>;
  sentenceActionStatus: Record<string, SentenceActionStatus>;
};

type TurnActions = {
  renderTargetLineWithWordLinks: (args: {
    baseKey: string;
    sourceText: string;
    targetText: string;
    disableWordClicks?: boolean;
  }) => JSX.Element;
  hasTurnCorrection: (turn: ConversationTurn) => boolean;
  toggleOpeningTranslation: () => void;
  playAudioUrl: (audioUrl?: string) => void;
  toggleUserTurnTranslation: (index: number) => Promise<void>;
  toggleUserTurnCorrection: (index: number) => Promise<void>;
  showAssistantTurnHint: (index: number) => void;
  regenerateGoal: () => Promise<void>;
  requestAddSentenceFromConversation: (key: string, sourceTextRaw: string, targetTextRaw: string) => Promise<void>;
};

type Props = {
  historyRef: RefObject<HTMLDivElement>;
  opening: OpeningState;
  display: DisplayState;
  visibility: VisibilityState;
  actions: TurnActions;
  conversationTurns: ConversationTurn[];
};

export default function ConversationTurns({
  historyRef,
  opening,
  display,
  visibility,
  actions,
  conversationTurns,
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

      {opening.text && (
        <div className="item-chat-entry item-chat-message item-chat-assistant">
          <p className="item-chat-bubble" />
        </div>
      )}

      {!conversationTurns.length && !opening.text && (
        <p className="hint item-conversation-empty">{t("newItem.conversationEmpty")}</p>
      )}

      {conversationTurns.map((turn, index) => (
        <div key={`conversation-turn-${index}`} className="item-chat-entry">
          <div className="item-chat-message item-chat-user">
            <p className="item-chat-meta">{t("newItem.conversationLabelYou")}</p>
            <p className="item-chat-bubble" />
          </div>

          <div className="item-chat-message item-chat-assistant">
            <button
              type="button"
              className={`item-chat-bubble item-chat-bubble-button${index === conversationTurns.length - 1 ? " item-chat-bubble-button-latest" : ""}${index === conversationTurns.length - 1 && !visibility.assistantSpeaking && !visibility.translationVisible[index] ? " item-chat-bubble-button-latest-ready" : ""}${index === conversationTurns.length - 1 && !visibility.assistantSpeaking && !visibility.translationVisible[index] && visibility.assistantHintsRemaining < 1 ? " item-chat-bubble-button-latest-empty" : ""}`}
              onClick={() => {
                if (
                  index === conversationTurns.length - 1
                  && !visibility.assistantSpeaking
                  && (visibility.assistantHintsRemaining > 0 || visibility.assistantRevealUsed[index])
                  && !visibility.translationVisible[index]
                ) {
                  actions.showAssistantTurnHint(index);
                }
              }}
              disabled={
                index !== conversationTurns.length - 1
                || visibility.assistantSpeaking
                || (visibility.assistantHintsRemaining < 1 && !visibility.assistantRevealUsed[index])
                || visibility.translationVisible[index]
              }
            >
              {index === conversationTurns.length - 1 && !visibility.assistantSpeaking && !visibility.translationVisible[index] && (
                <span className="conversation-last-bubble-hint">
                  <span className="conversation-last-bubble-icon" aria-hidden="true">||</span>
                  <span>
                    {visibility.assistantHintsRemaining > 0
                      ? t("conversation.latestBubbleHint", { count: visibility.assistantHintsRemaining })
                      : t("conversation.latestBubbleHintEmpty")}
                  </span>
                </span>
              )}
            </button>
            {index === conversationTurns.length - 1 && visibility.translationVisible[index] && (
              <div className="item-conversation-translation">
                <div className="conversation-turn-helper-target">
                  {actions.renderTargetLineWithWordLinks({
                    baseKey: `conversation-assistant-${index}`,
                    sourceText: turn.assistant_translation_text || "",
                    targetText: turn.assistant_text || "",
                    disableWordClicks: true,
                  })}
                </div>
                {Boolean(turn.assistant_translation_text) && (
                  <div className="conversation-line-translation">
                    {turn.assistant_translation_text}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ))}

      {display.pendingAssistantText && (
        <div className="item-chat-entry">
          {display.pendingUserTurn && (
            <div className="item-chat-message item-chat-user">
              <p className="item-chat-meta">{t("newItem.conversationLabelYou")}</p>
              <p className="item-chat-bubble" />
            </div>
          )}
          <div className="item-chat-message item-chat-assistant">
            <p className="item-chat-bubble" />
          </div>
        </div>
      )}
    </div>
  );
}
