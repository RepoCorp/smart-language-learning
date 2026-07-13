import { useEffect, useRef, useState } from "react";

import { evaluateTopicConversationGoal } from "../../api";
import type { ContentItemConversationResponse } from "../../types";
import type { StudyLanguageCode } from "../../studyLanguages";

type Args = {
  enabled: boolean;
  topic: string;
  notes: string;
  roleText: string;
  goalText: string;
  turns: ContentItemConversationResponse[];
  sourceLanguage: StudyLanguageCode;
  targetLanguage: StudyLanguageCode;
  onGoalChange: (goal: string) => void;
};

export function useConversationGoalEvaluation({
  enabled,
  topic,
  notes,
  roleText,
  goalText,
  turns,
  sourceLanguage,
  targetLanguage,
  onGoalChange,
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
    if (!enabled || !goalText.trim() || turns.length === 0) {
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
      goalText,
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
      const nextGoalSuggestion = (response.next_goal_suggestion || "").trim();
      setGoalAchievementMessage(achievementMessage);
      if (response.goal_achieved && nextGoalSuggestion) {
        onGoalChange(nextGoalSuggestion);
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
    goalText,
    notes,
    onGoalChange,
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
