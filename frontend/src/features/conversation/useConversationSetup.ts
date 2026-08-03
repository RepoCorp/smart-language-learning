import { useEffect, useState } from "react";

import { fetchContentTopics, regenerateTopicConversationGoal } from "../../api";
import type { StudyLanguageCode } from "../../studyLanguages";
import type { ConversationTransport, GoalDifficulty } from "./conversationTransportTypes";
import { CREATE_NEW_OPTION, RANDOM_TOPIC_OPTION } from "./conversationSetupOptions";

export type ConversationSetupGoal = {
  text: string;
  topic: string;
};

type Args = {
  sourceLanguage: StudyLanguageCode;
  targetLanguage: StudyLanguageCode;
};

export function useConversationSetup({ sourceLanguage, targetLanguage }: Args) {
  const [previousTopics, setPreviousTopics] = useState<string[]>([]);
  const [selectedTopic, setSelectedTopicValue] = useState<string>(RANDOM_TOPIC_OPTION);
  const [customTopic, setCustomTopicValue] = useState<string>("");
  const [notes, setNotesValue] = useState<string>("");
  const [role, setRoleValue] = useState<string>("");
  const [goalDifficulty, setGoalDifficultyValue] = useState<GoalDifficulty>("medium");
  const [selectedConversationMode, setSelectedConversationMode] = useState<ConversationTransport>("realtime");
  const [loadingTopics, setLoadingTopics] = useState<boolean>(false);
  const [goal, setGoal] = useState<ConversationSetupGoal | null>(null);
  const [goalGenerating, setGoalGenerating] = useState<boolean>(false);
  const [goalError, setGoalError] = useState<string>("");

  const shouldCreateNewTopic = selectedTopic === CREATE_NEW_OPTION;
  const selectedTopicText = (shouldCreateNewTopic ? customTopic : selectedTopic).trim();
  const resolvedTopic = goal?.topic || selectedTopicText;

  useEffect(() => {
    let active = true;
    const loadTopics = async (): Promise<void> => {
      setLoadingTopics(true);
      try {
        const response = await fetchContentTopics(sourceLanguage, targetLanguage);
        if (!active) {
          return;
        }
        setPreviousTopics(response.topics || []);
        setSelectedTopicValue(RANDOM_TOPIC_OPTION);
        setCustomTopicValue("");
      } catch {
        if (active) {
          setPreviousTopics([]);
          setSelectedTopicValue(RANDOM_TOPIC_OPTION);
          setCustomTopicValue("");
        }
      } finally {
        if (active) {
          setLoadingTopics(false);
        }
      }
    };

    void loadTopics();
    return () => {
      active = false;
    };
  }, [sourceLanguage, targetLanguage]);

  const clearGoal = (): void => {
    setGoal(null);
    setGoalError("");
  };

  const setSelectedTopic = (value: string): void => {
    clearGoal();
    setSelectedTopicValue(value);
  };

  const setCustomTopic = (value: string): void => {
    clearGoal();
    setCustomTopicValue(value);
  };

  const setNotes = (value: string): void => {
    clearGoal();
    setNotesValue(value);
  };

  const setRole = (value: string): void => {
    clearGoal();
    setRoleValue(value);
  };

  const setGoalDifficulty = (value: GoalDifficulty): void => {
    clearGoal();
    setGoalDifficultyValue(value);
  };

  const generateGoal = async (): Promise<void> => {
    if (!selectedTopicText || goalGenerating) {
      return;
    }
    setGoalGenerating(true);
    setGoalError("");
    try {
      const response = await regenerateTopicConversationGoal(
        selectedTopicText,
        notes.trim(),
        role.trim(),
        goalDifficulty,
        sourceLanguage,
        targetLanguage,
      );
      const nextGoal = (response.goal_text || "").trim();
      const nextTopic = (response.topic || "").trim();
      if (!nextGoal || !nextTopic) {
        throw new Error("Could not create a conversation goal. Please try again.");
      }
      setGoal({ text: nextGoal, topic: nextTopic });
    } catch (error) {
      setGoalError(error instanceof Error ? error.message : "Could not create a conversation goal. Please try again.");
    } finally {
      setGoalGenerating(false);
    }
  };

  return {
    previousTopics,
    selectedTopic,
    customTopic,
    notes,
    role,
    goalDifficulty,
    selectedConversationMode,
    loadingTopics,
    goal,
    goalGenerating,
    goalError,
    resolvedTopic,
    setSelectedTopic,
    setCustomTopic,
    setNotes,
    setRole,
    setGoalDifficulty,
    setSelectedConversationMode,
    generateGoal,
  };
}
