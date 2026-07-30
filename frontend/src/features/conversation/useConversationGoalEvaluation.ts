import { useEffect, useRef, useState } from "react";

import { evaluateTopicConversationGoal } from "../../api";
import type { ContentItemConversationResponse } from "../../types";
import type { StudyLanguageCode } from "../../studyLanguages";

type Args = {
  enabled: boolean;
  topic: string;
  notes: string;
  roleText: string;
  goalTexts: string[];
  currentGoalIndex: number;
  turns: ContentItemConversationResponse[];
  sourceLanguage: StudyLanguageCode;
  targetLanguage: StudyLanguageCode;
  onGoalAdvance: (nextGoalIndex: number, nextGoalText: string) => void;
  onGoalsCompleted: () => void;
};

export function useConversationGoalEvaluation({
  enabled,
  topic,
  notes,
  roleText,
  goalTexts,
  currentGoalIndex,
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

  useEffect(() => {
    if (enabled) {
      return;
    }
    requestIdRef.current += 1;
    lastEvaluatedTurnCountRef.current = 0;
    setGoalAchievementMessage("");
    setEvaluating(false);
  }, [enabled]);

  useEffect(() => {
    if (turns.length === 0) {
      lastEvaluatedTurnCountRef.current = 0;
      setEvaluating(false);
    }
  }, [turns.length]);

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
      setGoalAchievementMessage(achievementMessage);
      if (response.goal_achieved && response.all_goals_completed) {
        onGoalsCompleted();
        return;
      }
      if (response.goal_achieved) {
        onGoalAdvance(response.next_goal_index ?? currentGoalIndex + 1, (response.current_goal_text || "").trim());
      }
    }).catch(() => {
      if (requestIdRef.current !== requestId) {
        return;
      }
      setGoalAchievementMessage("");
    }).finally(() => {
      if (requestIdRef.current === requestId) {
        setEvaluating(false);
      }
    });
  }, [
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
