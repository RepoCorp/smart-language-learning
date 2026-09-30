import { useState } from "react";
import type { ConversationResponseLevel, ConversationSpeechSpeed } from "./conversationTransportTypes";
import {
  defaultConversationSpeechSpeed,
  getInitialConversationResponseLevel,
  getInitialConversationSpeechSpeed,
  setStoredConversationResponseLevel,
  setStoredConversationSpeechSpeed,
} from "./conversationPreferences";

export function useConversationPreferences() {
  const [speechSpeed, setSpeechSpeed] = useState<ConversationSpeechSpeed>(getInitialConversationSpeechSpeed);
  const [responseLevel, setResponseLevel] = useState<ConversationResponseLevel>(getInitialConversationResponseLevel);
  const updateSpeechSpeed = (speed: ConversationSpeechSpeed): void => {
    setSpeechSpeed(speed);
    setStoredConversationSpeechSpeed(speed);
  };

  const updateResponseLevel = (level: ConversationResponseLevel): void => {
    setResponseLevel(level);
    setStoredConversationResponseLevel(level);
    updateSpeechSpeed(defaultConversationSpeechSpeed(level));
  };


  return { speechSpeed, responseLevel, updateSpeechSpeed, updateResponseLevel };
}
