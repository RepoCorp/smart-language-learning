import type { RefObject } from "react";

import { useI18n } from "../i18n";
import type { ContentItemConversationResponse } from "../types";

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
  pendingAssistantText: string;
};

type VisibilityState = {
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
  }) => JSX.Element;
  hasTurnCorrection: (turn: ConversationTurn) => boolean;
  toggleOpeningTranslation: () => void;
  playAudioUrl: (audioUrl?: string) => void;
  toggleUserTurnTranslation: (index: number) => Promise<void>;
  toggleUserTurnCorrection: (index: number) => Promise<void>;
  toggleAssistantTurnTranslation: (index: number) => void;
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
  conversationTurns,
}: Props): JSX.Element {
  const { t } = useI18n();

  return (
    <div ref={historyRef} className="item-questions-history item-chat-thread item-conversation-history">
      {opening.text && (
        <div className="item-chat-entry item-chat-message item-chat-assistant">
          <p className="item-chat-bubble" />
        </div>
      )}

      {!conversationTurns.length && !opening.text && (
        <p className="hint item-conversation-empty">{t("newItem.conversationEmpty")}</p>
      )}

      {conversationTurns.map((_, index) => (
        <div key={`conversation-turn-${index}`} className="item-chat-entry">
          <div className="item-chat-message item-chat-user">
            <p className="item-chat-meta">{t("newItem.conversationLabelYou")}</p>
            <p className="item-chat-bubble" />
          </div>

          <div className="item-chat-message item-chat-assistant">
            <p className="item-chat-bubble" />
          </div>
        </div>
      ))}

      {display.pendingAssistantText && (
        <div className="item-chat-entry item-chat-message item-chat-assistant">
          <p className="item-chat-bubble" />
        </div>
      )}
    </div>
  );
}
