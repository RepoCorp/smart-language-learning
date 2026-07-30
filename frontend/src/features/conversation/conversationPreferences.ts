import type { ConversationResponseLevel, ConversationSpeechSpeed } from "./conversationTransportTypes";

const CONVERSATION_SPEECH_SPEED_STORAGE_KEY = "conversation_speech_speed";
const CONVERSATION_RESPONSE_LEVEL_STORAGE_KEY = "conversation_response_level";

export function getInitialConversationSpeechSpeed(): ConversationSpeechSpeed {
  if (typeof window === "undefined") {
    return "normal";
  }
  const stored = window.localStorage.getItem(CONVERSATION_SPEECH_SPEED_STORAGE_KEY);
  return stored === "slow" || stored === "super_slow" ? stored : "normal";
}

export function setStoredConversationSpeechSpeed(speed: ConversationSpeechSpeed): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(CONVERSATION_SPEECH_SPEED_STORAGE_KEY, speed);
}

export function getInitialConversationResponseLevel(): ConversationResponseLevel {
  if (typeof window === "undefined") {
    return "A2";
  }
  const stored = window.localStorage.getItem(CONVERSATION_RESPONSE_LEVEL_STORAGE_KEY);
  return stored === "A1" || stored === "B1" ? stored : "A2";
}

export function setStoredConversationResponseLevel(level: ConversationResponseLevel): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(CONVERSATION_RESPONSE_LEVEL_STORAGE_KEY, level);
}
