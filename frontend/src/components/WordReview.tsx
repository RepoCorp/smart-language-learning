import { useEffect, useMemo, useRef, useState } from "react";

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
  const languageLabel = isSpanishToGerman ? "German" : "Spanish";

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
      setFeedback("Please enter an answer.");
      return;
    }

    const inputMatches = normalize(answer) === normalize(expectedAnswer);
    const exceededHintLimit = hasExceededHintLimit(expectedAnswer);
    if (inputMatches && exceededHintLimit) {
      requireWrongAccept(
        `Correct answer entered, but too many hints were used. It will be treated as incorrect: ${expectedAnswer}`,
      );
      return;
    }
    if (inputMatches) {
      await submitWithFeedback(true, "Correct");
      return;
    }
    requireWrongAccept(`Incorrect. Answer: ${expectedAnswer}`);
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
        `Correct answer entered, but too many hints were used. It will be treated as incorrect: ${expectedAnswer}`,
      );
      return;
    }
    void submitWithFeedback(true, "Correct");
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
      <p className="prompt">Write in {languageLabel}: {promptText}</p>
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
        placeholder="Your answer"
        data-testid="word-input"
        disabled={isSubmitting || awaitingWrongAccept}
        autoFocus
      />
      <p className="hint">{hint ? `Hint: ${hint}` : "\u00a0"}</p>
      <div className="actions">
        {!awaitingWrongAccept && (
          <>
            <button onClick={showInputAwareHint} disabled={isSubmitting}>Hint</button>
            <button onClick={check} disabled={isSubmitting || !answer.trim()}>Check</button>
          </>
        )}
        {awaitingWrongAccept && (
          <button onClick={() => void acceptWrongAnswer()} disabled={isSubmitting}>
            Accept
          </button>
        )}
      </div>
      {feedback && <p>{feedback}</p>}
    </div>
  );
}
