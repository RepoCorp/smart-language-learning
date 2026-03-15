import { useEffect, useState } from "react";

import { useI18n } from "../i18n";
import type { SessionItem } from "../types";

function normalize(value: string): string {
  return value.trim();
}

interface PhraseReviewProps {
  item: SessionItem;
  onAnswered: (correct: boolean) => Promise<void>;
}

const FEEDBACK_DELAY_MS = 2000;

export default function PhraseReview({ item, onAnswered }: PhraseReviewProps): JSX.Element {
  const { t } = useI18n();
  const [feedback, setFeedback] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const isSpanishToGerman = item.direction !== "de_to_es";
  const promptText = isSpanishToGerman ? item.spanish_text : item.german_text;
  const expectedAnswer = isSpanishToGerman ? item.german_text : item.spanish_text;
  const languageLabel = isSpanishToGerman ? t("review.language.german") : t("review.language.spanish");

  const choose = async (choice: string): Promise<void> => {
    if (isSubmitting) {
      return;
    }

    const correct = normalize(choice) === normalize(expectedAnswer);
    setIsSubmitting(true);
    setFeedback(correct ? t("phrase.feedback.correct") : t("phrase.feedback.incorrect", { answer: expectedAnswer }));
    try {
      await new Promise((resolve) => setTimeout(resolve, FEEDBACK_DELAY_MS));
      await onAnswered(correct);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (isSubmitting) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      const index = Number.parseInt(event.key, 10);
      if (!Number.isInteger(index)) {
        return;
      }
      if (index < 1 || index > item.options.length) {
        return;
      }
      event.preventDefault();
      void choose(item.options[index - 1]);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isSubmitting, item.options]);

  const markAsWrongByChoice = async (): Promise<void> => {
    if (isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    setFeedback(t("phrase.feedback.markedWrong", { answer: expectedAnswer }));
    try {
      await new Promise((resolve) => setTimeout(resolve, FEEDBACK_DELAY_MS));
      await onAnswered(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <p className="prompt">{t("phrase.prompt", { language: languageLabel, text: promptText })}</p>
      <div className="options">
        {item.options.map((option, idx) => (
          <button key={option} onClick={() => choose(option)} disabled={isSubmitting}>
            {idx + 1}. {option}
          </button>
        ))}
      </div>
      <div className="actions">
        <button onClick={() => void markAsWrongByChoice()} disabled={isSubmitting}>
          {t("phrase.markFailed")}
        </button>
      </div>
      {feedback && <p>{feedback}</p>}
    </div>
  );
}
