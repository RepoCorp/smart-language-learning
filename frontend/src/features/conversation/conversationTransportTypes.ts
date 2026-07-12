import type { ContentItemConversationResponse } from "../../types";
import type { StudyLanguageCode } from "../../studyLanguages";

export type ConversationTransport = "http" | "realtime";
export type GoalDifficulty = "easy" | "medium" | "hard";
export type ConversationSpeechSpeed = "normal" | "slow" | "super_slow";
export type ConversationResponseLevel = "A1" | "A2" | "B1";

export type ConversationHistoryEntry = {
  user_text: string;
  assistant_text: string;
};

export type BaseConversationTransportArgs = {
  sourceLanguage: StudyLanguageCode;
  targetLanguage: StudyLanguageCode;
  onError: (message: string) => void;
  onLoadingChange: (loading: boolean) => void;
  onAssistantSpeakingChange: (speaking: boolean) => void;
  onPendingUserTurnChange: (pending: boolean) => void;
  onConversationTurn: (response: ContentItemConversationResponse) => void;
  onPendingAssistantTextChange: (text: string) => void;
  onConversationGoalChange: (goal: string) => void;
  playAudioUrl: (audioUrl?: string) => void;
  conversationHistory: ConversationHistoryEntry[];
  activeTopic: string;
  activeNotes: string;
  activeRole: string;
  conversationGoal: string;
  speechSpeed: ConversationSpeechSpeed;
  responseLevel: ConversationResponseLevel;
};

export type StartConversationTransportArgs = {
  topic: string;
  notes: string;
  roleText: string;
  goalDifficulty: GoalDifficulty;
};
