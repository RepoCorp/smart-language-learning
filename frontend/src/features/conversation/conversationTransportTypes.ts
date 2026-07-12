import type { ContentItemConversationResponse } from "../../types";
import type { StudyLanguageCode } from "../../studyLanguages";

export type ConversationTransport = "http" | "realtime";
export type GoalDifficulty = "easy" | "medium" | "hard";

export type ConversationHistoryEntry = {
  user_text: string;
  assistant_text: string;
};

export type BaseConversationTransportArgs = {
  sourceLanguage: StudyLanguageCode;
  targetLanguage: StudyLanguageCode;
  onError: (message: string) => void;
  onLoadingChange: (loading: boolean) => void;
  onConversationTurn: (response: ContentItemConversationResponse) => void;
  onPendingAssistantTextChange: (text: string) => void;
  onConversationGoalChange: (goal: string) => void;
  playAudioUrl: (audioUrl?: string) => void;
  conversationHistory: ConversationHistoryEntry[];
  activeTopic: string;
  activeNotes: string;
  activeRole: string;
  conversationGoal: string;
};

export type StartConversationTransportArgs = {
  topic: string;
  notes: string;
  roleText: string;
  goalDifficulty: GoalDifficulty;
};
