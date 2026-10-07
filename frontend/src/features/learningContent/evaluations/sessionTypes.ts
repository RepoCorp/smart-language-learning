import type { ReactNode } from "react";

export interface LearningEvaluationPayload {
  id: string;
  content: unknown;
}

export interface SessionEvaluationProps {
  payload: LearningEvaluationPayload;
  completed: boolean;
  disabled: boolean;
  onAnswered: (correct: boolean) => Promise<void>;
  onNext: () => void;
  postReviewActions?: ReactNode;
  answerDetails?: ReactNode;
}
