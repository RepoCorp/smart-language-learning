import { useEffect, useMemo, useRef, useState } from "react";

import { useI18n } from "../i18n";
import { usePromptPreferences } from "../promptPreferences";
import { type StudyLanguageCode, useStudyLanguages } from "../studyLanguages";
import type { SessionItem } from "../types";

function normalize(value: string): string {
  return value.trim();
}

function countLetters(value: string): number {
  const matches = value.match(/[A-Za-zÀ-ÖØ-öø-ÿ]/g);
  return matches ? matches.length : 0;
}

interface WordReviewProps {
  item: SessionItem;
  onAnswered: (correct: boolean) => Promise<void>;
}

const FEEDBACK_DELAY_MS = 1000;

export default function WordReview({ item, onAnswered }: WordReviewProps): JSX.Element {
  const { t } = useI18n();
  const { targetPromptMode } = usePromptPreferences();
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
  const [showPromptText, setShowPromptText] = useState<boolean>(targetPromptMode === "text");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const isSpanishToGerman = item.direction !== "de_to_es";
  const useMultipleChoice = !isSpanishToGerman && item.options.length > 0;
  const allowPromptAudio = !isSpanishToGerman;
  const promptText = isSpanishToGerman ? item.spanish_text : item.german_text;
  const expectedAnswer = isSpanishToGerman ? item.german_text : item.spanish_text;
  const languageLabel = isSpanishToGerman
    ? t(languageKeyByCode[targetLanguage])
    : t(languageKeyByCode[sourceLanguage]);

  const hint = useMemo(() => hintLetter, [hintLetter]);
  const hidePromptText = targetPromptMode === "audio" && allowPromptAudio && !showPromptText;

  const hasExceededHintLimit = (value: string): boolean => {
    const totalLetters = countLetters(value);
    return totalLetters > 0 && hintedLetters > 1 && hintedLetters / totalLetters > 0.3;
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

  const choose = async (choice: string): Promise<void> => {
    if (!useMultipleChoice || isSubmitting) {
      return;
    }
    const correct = normalize(choice) === normalize(expectedAnswer);
    await submitWithFeedback(correct, correct ? t("word.feedback.correct") : t("word.feedback.incorrect", { answer: expectedAnswer }));
  };

  const showInputAwareHint = (): void => {
    if (useMultipleChoice) {
      return;
    }
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
      const revealedLetters = countLetters(expectedAnswer.slice(0, prefixLen + 1));
      setHintedLetters((value) => Math.max(value, revealedLetters));
    }
  };

  const handleHintButtonPress = (): void => {
    showInputAwareHint();
    window.setTimeout(() => {
      inputRef.current?.focus({ preventScroll: true });
    }, 0);
  };

  const check = async (): Promise<void> => {
    if (useMultipleChoice) {
      return;
    }
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
    if (useMultipleChoice) {
      return;
    }
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

  const playPromptAudio = (): void => {
    if (!allowPromptAudio || !item.audio_url) {
      return;
    }
    const audio = new Audio(item.audio_url);
    void audio.play().catch(() => {});
  };

  useEffect(() => {
    if (!useMultipleChoice) {
      inputRef.current?.focus();
    }
  }, [useMultipleChoice]);

  useEffect(() => {
    setShowPromptText(targetPromptMode === "text");
  }, [targetPromptMode]);

  useEffect(() => {
    if (targetPromptMode !== "audio") {
      return;
    }
    if (!allowPromptAudio) {
      return;
    }
    playPromptAudio();
  }, [targetPromptMode, item.id, allowPromptAudio]);

  useEffect(() => {
    if (useMultipleChoice || !awaitingWrongAccept) {
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
  }, [awaitingWrongAccept, isSubmitting, useMultipleChoice]);

  useEffect(() => {
    if (!useMultipleChoice || isSubmitting) {
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
  }, [isSubmitting, item.options, useMultipleChoice]);

  if (useMultipleChoice) {
    return (
      <div>
        {targetPromptMode === "audio" && allowPromptAudio && (
          <div className="prompt-visibility-controls">
            <button type="button" className="secondary-button" onClick={() => setShowPromptText((value) => !value)}>
              {showPromptText ? t("prompt.hideText") : t("prompt.showText")}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={playPromptAudio}
              disabled={!allowPromptAudio || !item.audio_url}
            >
              {t("prompt.playAudio")}
            </button>
          </div>
        )}
        {hidePromptText ? (
          <p className="prompt prompt-audio-placeholder">{t("prompt.audioOnly")}</p>
        ) : (
          <p className="prompt">{t("phrase.prompt", { language: languageLabel, text: promptText })}</p>
        )}
        <div className="options">
          {item.options.map((option, idx) => (
            <button key={option} onClick={() => void choose(option)} disabled={isSubmitting}>
              {idx + 1}. {option}
            </button>
          ))}
        </div>
        {feedback && <p>{feedback}</p>}
      </div>
    );
  }

  return (
    <div>
      {targetPromptMode === "audio" && allowPromptAudio && (
        <div className="prompt-visibility-controls">
          <button type="button" className="secondary-button" onClick={() => setShowPromptText((value) => !value)}>
            {showPromptText ? t("prompt.hideText") : t("prompt.showText")}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={playPromptAudio}
            disabled={!allowPromptAudio || !item.audio_url}
          >
              {t("prompt.playAudio")}
            </button>
          </div>
        )}
      {hidePromptText ? (
        <p className="prompt prompt-audio-placeholder">{t("prompt.audioOnly")}</p>
      ) : (
        <p className="prompt">{t("word.prompt", { language: languageLabel, text: promptText })}</p>
      )}
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
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />
      <p className="hint">{hint ? t("word.hint", { letter: hint }) : "\u00a0"}</p>
      <div className="actions">
        {!awaitingWrongAccept && (
          <>
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onPointerDown={(event) => event.preventDefault()}
              onTouchStart={(event) => event.preventDefault()}
              onClick={handleHintButtonPress}
              disabled={isSubmitting}
            >
              {t("word.hintButton")}
            </button>
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
