import { useEffect, useMemo, useRef, useState } from "react";

import { useI18n } from "../i18n";
import { type StudyLanguageCode, useStudyLanguages } from "../studyLanguages";
import type { SessionItem } from "../types";

function normalize(value: string): string {
  return value.trim();
}

interface WordReviewProps {
  item: SessionItem;
  onAnswered: (correct: boolean) => Promise<void>;
}

const FEEDBACK_DELAY_MS = 1000;

export default function WordReview({ item, onAnswered }: WordReviewProps): JSX.Element {
  const { t } = useI18n();
  const { sourceLanguage, targetLanguage } = useStudyLanguages();
  const languageKeyByCode: Record<StudyLanguageCode, Parameters<typeof t>[0]> = {
    spanish: "study.language.spanish",
    english: "study.language.english",
    german: "study.language.german",
    french: "study.language.french",
    italian: "study.language.italian",
    portuguese: "study.language.portuguese",
  };
  const [answer, setAnswer] = useState<string>("");
  const [feedback, setFeedback] = useState<string>("");
  const [hintLetter, setHintLetter] = useState<string>("");
  const [hintedLetters, setHintedLetters] = useState<number>(0);
  const [clearedByHint, setClearedByHint] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [awaitingWrongAccept, setAwaitingWrongAccept] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const isSpanishToGerman = item.direction !== "de_to_es";
  const promptText = isSpanishToGerman ? item.spanish_text : item.german_text;
  const expectedAnswer = isSpanishToGerman ? item.german_text : item.spanish_text;
  const languageLabel = isSpanishToGerman
    ? t(languageKeyByCode[targetLanguage])
    : t(languageKeyByCode[sourceLanguage]);

  const hint = useMemo(() => hintLetter, [hintLetter]);

  const hasExceededHintLimit = (value: string): boolean => {
    return value.length > 0 && hintedLetters / value.length > 0.3;
  };

  const submitWithFeedback = async (correct: boolean, message: string): Promise<void> => {
    setIsSubmitting(true);
    setFeedback(message);
    try {
      await new Promise((resolve) => setTimeout(resolve, FEEDBACK_DELAY_MS));
      await onAnswered(correct);
    } finally {
      setIsSubmitting(false);
    }
  };

  const requireWrongAccept = (message: string): void => {
    setFeedback(message);
    setAwaitingWrongAccept(true);
  };

  const showInputAwareHint = (): void => {
    if (isSubmitting) {
      return;
    }

    const currentAnswer = answer;
    const maxLen = Math.min(currentAnswer.length, expectedAnswer.length);
    let prefixLen = 0;

    while (prefixLen < maxLen) {
      if (currentAnswer[prefixLen] !== expectedAnswer[prefixLen]) {
        break;
      }
      prefixLen += 1;
    }

    const correctedAnswer = currentAnswer.slice(0, prefixLen);
    if (correctedAnswer !== currentAnswer) {
      setAnswer(correctedAnswer);
      setClearedByHint(currentAnswer.length > 0 && correctedAnswer.length === 0);
    } else {
      setClearedByHint(false);
    }

    const nextHintLetter = expectedAnswer.charAt(prefixLen);
    setHintLetter(nextHintLetter);
    if (nextHintLetter) {
      setHintedLetters((value) => Math.max(value, prefixLen + 1));
    }
  };

  const check = async (): Promise<void> => {
    if (isSubmitting) {
      return;
    }

    if (!answer.trim()) {
      if (clearedByHint) {
        setClearedByHint(false);
        return;
      }
      setFeedback(t("word.feedback.empty"));
      return;
    }

    const inputMatches = normalize(answer) === normalize(expectedAnswer);
    const exceededHintLimit = hasExceededHintLimit(expectedAnswer);
    if (inputMatches && exceededHintLimit) {
      requireWrongAccept(
        t("word.feedback.tooManyHints", { answer: expectedAnswer }),
      );
      return;
    }
    if (inputMatches) {
      await submitWithFeedback(true, t("word.feedback.correct"));
      return;
    }
    requireWrongAccept(t("word.feedback.incorrect", { answer: expectedAnswer }));
  };

  const handleAnswerChange = (value: string): void => {
    if (isSubmitting) {
      return;
    }

    setAnswer(value);
    setHintLetter("");
    setClearedByHint(false);
    setAwaitingWrongAccept(false);

    if (normalize(value) !== normalize(expectedAnswer)) {
      return;
    }

    const exceededHintLimit = hasExceededHintLimit(expectedAnswer);
    if (exceededHintLimit) {
      requireWrongAccept(
        t("word.feedback.tooManyHints", { answer: expectedAnswer }),
      );
      return;
    }
    void submitWithFeedback(true, t("word.feedback.correct"));
  };

  const acceptWrongAnswer = async (): Promise<void> => {
    if (!awaitingWrongAccept || isSubmitting) {
      return;
    }
    setAwaitingWrongAccept(false);
    setIsSubmitting(true);
    try {
      await onAnswered(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!awaitingWrongAccept) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Enter") {
        return;
      }
      event.preventDefault();
      void acceptWrongAnswer();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [awaitingWrongAccept, isSubmitting]);

  return (
    <div>
      <p className="prompt">{t("word.prompt", { language: languageLabel, text: promptText })}</p>
      <input
        ref={inputRef}
        value={answer}
        onChange={(e) => handleAnswerChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") {
            return;
          }
          e.preventDefault();
          if (awaitingWrongAccept) {
            void acceptWrongAnswer();
            return;
          }
          if (e.ctrlKey) {
            showInputAwareHint();
            return;
          }
          void check();
        }}
        placeholder={t("word.input.placeholder")}
        data-testid="word-input"
        disabled={isSubmitting || awaitingWrongAccept}
        autoFocus
      />
      <p className="hint">{hint ? t("word.hint", { letter: hint }) : "\u00a0"}</p>
      <div className="actions">
        {!awaitingWrongAccept && (
          <>
            <button onClick={showInputAwareHint} disabled={isSubmitting}>{t("word.hintButton")}</button>
            <button onClick={check} disabled={isSubmitting || !answer.trim()}>{t("word.checkButton")}</button>
          </>
        )}
        {awaitingWrongAccept && (
          <button onClick={() => void acceptWrongAnswer()} disabled={isSubmitting}>
            {t("word.acceptButton")}
          </button>
        )}
      </div>
      {feedback && <p>{feedback}</p>}
    </div>
  );
}
