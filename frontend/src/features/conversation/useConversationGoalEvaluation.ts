import { useEffect, useRef, useState } from "react";

import { evaluateTopicConversationGoal } from "../../api";
import type { ContentItemConversationResponse } from "../../types";
import type { StudyLanguageCode } from "../../studyLanguages";

type Args = {
  enabled: boolean;
  assistantSpeaking: boolean;
  topic: string;
  notes: string;
  roleText: string;
  goalTexts: string[];
  currentGoalIndex: number;
  resetKey: number;
  turns: ContentItemConversationResponse[];
  sourceLanguage: StudyLanguageCode;
  targetLanguage: StudyLanguageCode;
  onGoalAdvance: (nextGoalIndex: number, nextGoalText: string) => void;
  onGoalsCompleted: () => void;
};

export function useConversationGoalEvaluation({
  enabled,
  assistantSpeaking,
  topic,
  notes,
  roleText,
  goalTexts,
  currentGoalIndex,
  resetKey,
  turns,
  sourceLanguage,
  targetLanguage,
  onGoalAdvance,
  onGoalsCompleted,
}: Args): { goalAchievementMessage: string; evaluating: boolean; clearGoalAchievementMessage: () => void } {
  const [goalAchievementMessage, setGoalAchievementMessage] = useState<string>("");
  const [evaluating, setEvaluating] = useState<boolean>(false);
  const requestIdRef = useRef<number>(0);
  const lastEvaluatedTurnCountRef = useRef<number>(0);
  const pendingResultRef = useRef<null | {
    goalAchieved: boolean;
    allGoalsCompleted: boolean;
    nextGoalIndex: number;
    currentGoalText: string;
    achievementMessage: string;
  }>(null);

  const applyGoalResult = (
    goalAchieved: boolean,
    allGoalsCompleted: boolean,
    nextGoalIndex: number,
    nextGoalText: string,
    achievementMessage: string,
  ): void => {
    setGoalAchievementMessage(achievementMessage);
    if (goalAchieved && allGoalsCompleted) {
      onGoalsCompleted();
      return;
    }
    if (goalAchieved) {
      onGoalAdvance(nextGoalIndex, nextGoalText);
    }
  };

  useEffect(() => {
    if (enabled) {
      return;
    }
    requestIdRef.current += 1;
    lastEvaluatedTurnCountRef.current = 0;
    pendingResultRef.current = null;
    setGoalAchievementMessage("");
    setEvaluating(false);
  }, [enabled]);

  useEffect(() => {
    if (turns.length === 0) {
      lastEvaluatedTurnCountRef.current = 0;
      pendingResultRef.current = null;
      setEvaluating(false);
    }
  }, [turns.length]);

  useEffect(() => {
    requestIdRef.current += 1;
    lastEvaluatedTurnCountRef.current = turns.length;
    pendingResultRef.current = null;
    setGoalAchievementMessage("");
    setEvaluating(false);
  }, [resetKey]);

  useEffect(() => {
    if (assistantSpeaking) {
      return;
    }
    const pendingResult = pendingResultRef.current;
    if (!pendingResult) {
      return;
    }
    pendingResultRef.current = null;
    applyGoalResult(
      pendingResult.goalAchieved,
      pendingResult.allGoalsCompleted,
      pendingResult.nextGoalIndex,
      pendingResult.currentGoalText,
      pendingResult.achievementMessage,
    );
  }, [assistantSpeaking, onGoalAdvance, onGoalsCompleted]);

  useEffect(() => {
    const currentGoalText = goalTexts[currentGoalIndex] || "";
    if (!enabled || !currentGoalText.trim() || turns.length === 0) {
      return;
    }
    if (turns.length <= lastEvaluatedTurnCountRef.current) {
      return;
    }

    const latestTurnIndex = turns.length - 1;
    const latestTurn = turns[latestTurnIndex];
    const latestUserText = (latestTurn.user_text || "").trim();
    if (!latestUserText) {
      lastEvaluatedTurnCountRef.current = turns.length;
      return;
    }

    lastEvaluatedTurnCountRef.current = turns.length;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setEvaluating(true);

    void evaluateTopicConversationGoal(
      topic,
      notes,
      roleText,
      goalTexts,
      currentGoalIndex,
      latestUserText,
      turns.slice(0, latestTurnIndex).map((turn) => ({
        user_text: turn.user_text,
        assistant_text: turn.assistant_text,
      })),
      sourceLanguage,
      targetLanguage,
    ).then((response) => {
      if (requestIdRef.current !== requestId) {
        return;
      }
      const achievementMessage = (response.goal_achievement_message || "").trim();
      const goalAchieved = Boolean(response.goal_achieved);
      const allGoalsCompleted = Boolean(response.all_goals_completed);
      const nextGoalIndex = response.next_goal_index ?? currentGoalIndex + 1;
      const nextGoalText = (response.current_goal_text || "").trim();

      if (assistantSpeaking) {
        pendingResultRef.current = {
          goalAchieved,
          allGoalsCompleted,
          nextGoalIndex,
          currentGoalText: nextGoalText,
          achievementMessage,
        };
        return;
      }
      applyGoalResult(goalAchieved, allGoalsCompleted, nextGoalIndex, nextGoalText, achievementMessage);
    }).catch(() => {
      if (requestIdRef.current !== requestId) {
        return;
      }
      pendingResultRef.current = null;
      setGoalAchievementMessage("");
    }).finally(() => {
      if (requestIdRef.current === requestId) {
        setEvaluating(false);
      }
    });
  }, [
    assistantSpeaking,
    enabled,
    currentGoalIndex,
    goalTexts,
    notes,
    onGoalAdvance,
    onGoalsCompleted,
    roleText,
    sourceLanguage,
    targetLanguage,
    topic,
    turns,
  ]);

  return {
    goalAchievementMessage,
    evaluating,
    clearGoalAchievementMessage: () => setGoalAchievementMessage(""),
  };
}
