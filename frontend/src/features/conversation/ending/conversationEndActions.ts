type ConversationEndOptions = {
  stopRecording: (submit: boolean) => void;
  closeRealtimeSession: () => void;
  setConversationError: (message: string) => void;
  setConversationPendingAssistantText: (text: string) => void;
  setConversationPendingUserTurn: (pending: boolean) => void;
  setAssistantSpeaking: (speaking: boolean) => void;
  setConversationFinished: (finished: boolean) => void;
  setConversationEnded: (ended: boolean) => void;
  resetConversationReview: () => void;
  confirmEnd: () => boolean;
};

export function createConversationEndActions(options: ConversationEndOptions) {
  const finishConversation = (): void => {
    options.stopRecording(false);
    options.closeRealtimeSession();
    options.setConversationError("");
    options.setConversationPendingAssistantText("");
    options.setConversationPendingUserTurn(false);
    options.setAssistantSpeaking(false);
    options.setConversationFinished(true);
    options.setConversationEnded(false);
    options.resetConversationReview();
  };

  return {
    finishConversation,
    endConversation: (): void => {
      if (options.confirmEnd()) finishConversation();
    },
  };
}
