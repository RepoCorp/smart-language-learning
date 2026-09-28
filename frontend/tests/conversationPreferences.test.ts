import { beforeEach, describe, expect, it } from "vitest";
import {
  defaultConversationSpeechSpeed,
  getInitialConversationResponseLevel,
  getInitialConversationSpeechSpeed,
  setStoredConversationResponseLevel,
  setStoredConversationSpeechSpeed,
} from "../src/features/conversation/conversationPreferences";

describe("conversation speed defaults", () => {
  beforeEach(() => {
    localStorage.removeItem("conversation_speech_speed");
    localStorage.removeItem("conversation_response_level");
  });

  it.each([
    ["A0", "super_slow"], ["A1", "slow"], ["A2", "normal"], ["B1", "normal"],
  ] as const)("uses %s's default speed %s when no preference exists", (level, speed) => {
    expect(defaultConversationSpeechSpeed(level)).toBe(speed);
    setStoredConversationResponseLevel(level);
    expect(getInitialConversationSpeechSpeed()).toBe(speed);
  });

  it.each(["normal", "slow", "super_slow"] as const)("preserves a manual %s override", speed => {
    setStoredConversationResponseLevel("A0");
    setStoredConversationSpeechSpeed(speed);
    expect(getInitialConversationSpeechSpeed()).toBe(speed);
    expect(getInitialConversationResponseLevel()).toBe("A0");
  });

  it("uses the level default when a stored speed is invalid", () => {
    setStoredConversationResponseLevel("A1");
    localStorage.setItem("conversation_speech_speed", "invalid");
    expect(getInitialConversationSpeechSpeed()).toBe("slow");
  });

  it("keeps the A2 and normal defaults for a new user", () => {
    expect(getInitialConversationResponseLevel()).toBe("A2");
    expect(getInitialConversationSpeechSpeed()).toBe("normal");
  });
});
