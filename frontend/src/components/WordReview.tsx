import { useEffect, useRef, useState } from "react";

import { shouldAutoplayPrompt } from "../audioAutoplayGuard";
import { useI18n } from "../i18n";
import { usePromptPreferences } from "../promptPreferences";
import { type StudyLanguageCode, useStudyLanguages } from "../studyLanguages";
import type { SessionItem } from "../types";
import DangerousButton from "./DangerousButton";

function normalize(value: string): string {
  return value.trim();
}

function countLetters(value: string): number {
  const matches = value.match(/[A-Za-zÀ-ÖØ-öø-ÿ]/g);
  return matches ? matches.length : 0;
}

function isLetter(value: string): boolean {
  return /^[A-Za-zÀ-ÖØ-öø-ÿ]$/.test(value);
}

function matchLetterCase(letter: string, reference: string): string {
  return reference === reference.toUpperCase() ? letter.toUpperCase() : letter.toLowerCase();
}

function nextLetterSuggestions(correctLetter: string, offset: number): string[] {
  if (!isLetter(correctLetter)) {
    return [];
  }
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  const correctLower = correctLetter.toLowerCase();
  const wrongLetters = alphabet
    .split("")
    .filter((letter) => letter !== correctLower)
    .slice(offset % 20, (offset % 20) + 2);
  const suggestions = [
    matchLetterCase(correctLower, correctLetter),
    ...wrongLetters.map((letter) => matchLetterCase(letter, correctLetter)),
  ];
  const correctIndex = offset % suggestions.length;
  const correct = suggestions.shift();
  if (!correct) {
    return [];
  }
  suggestions.splice(correctIndex, 0, correct);
  return suggestions;
}

interface WordReviewProps {
  item: SessionItem;
  onAnswered: (correct: boolean) => Promise<void>;
  onOpenItem?: (itemId: number) => void;
}

const FEEDBACK_DELAY_MS = 1000;

export default function WordReview({ item, onAnswered, onOpenItem }: WordReviewProps): JSX.Element {
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
  const [hintStepsUsed, setHintStepsUsed] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [awaitingWrongAccept, setAwaitingWrongAccept] = useState<boolean>(false);
  const [showPromptText, setShowPromptText] = useState<boolean>(targetPromptMode === "text");
  const [answerRevealed, setAnswerRevealed] = useState<boolean>(false);
  const [letterSuggestions, setLetterSuggestions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const isSpanishToGerman = item.direction !== "de_to_es";
  const useSelfGradedAnswer = !isSpanishToGerman;
  const allowPromptAudio = !isSpanishToGerman;
  const promptText = isSpanishToGerman ? item.spanish_text : item.german_text;
  const expectedAnswer = isSpanishToGerman ? item.german_text : item.spanish_text;
  const languageLabel = isSpanishToGerman
    ? t(languageKeyByCode[targetLanguage])
    : t(languageKeyByCode[sourceLanguage]);

  const hint = hintLetter;
  const hidePromptText = targetPromptMode === "audio" && allowPromptAudio && !showPromptText;

  const hasExceededHintLimit = (value: string): boolean => {
    const totalLetters = countLetters(value);
    return totalLetters > 0 && hintStepsUsed > 1 && hintStepsUsed / totalLetters > 0.3;
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

  const markSelfGradedAnswer = async (correct: boolean): Promise<void> => {
    if (!useSelfGradedAnswer || isSubmitting || !answerRevealed) {
      return;
    }
    await submitWithFeedback(correct, correct ? t("word.feedback.correct") : t("word.feedback.markedWrong", { answer: expectedAnswer }));
  };

  const failWrittenAnswer = async (): Promise<void> => {
    if (useSelfGradedAnswer || isSubmitting) {
      return;
    }
    await submitWithFeedback(false, t("word.feedback.markedWrong", { answer: expectedAnswer }));
  };

  const showInputAwareHint = (): void => {
    if (useSelfGradedAnswer) {
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
    }

    const nextHintLetter = expectedAnswer.charAt(prefixLen);
    const isNewHintStep = Boolean(nextHintLetter) && nextHintLetter !== hintLetter;
    setHintLetter(nextHintLetter);
    setLetterSuggestions([]);
    if (isNewHintStep) {
      setHintStepsUsed((value) => value + 1);
    }
  };

  const handleHintButtonPress = (): void => {
    showInputAwareHint();
    window.setTimeout(() => {
      inputRef.current?.focus({ preventScroll: true });
    }, 0);
  };

  const handleAnswerChange = (value: string): void => {
    if (useSelfGradedAnswer) {
      return;
    }
    if (isSubmitting) {
      return;
    }

    if (!expectedAnswer.startsWith(value)) {
      const wrongText = value.slice(answer.length) || value.slice(-1);
      setFeedback(t("word.feedback.wrongLetter", { letter: wrongText }));
      setLetterSuggestions(nextLetterSuggestions(expectedAnswer.charAt(answer.length), answer.length));
      return;
    }

    setAnswer(value);
    setFeedback("");
    setLetterSuggestions([]);
    setHintLetter("");
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
    if (!useSelfGradedAnswer) {
      inputRef.current?.focus();
    }
  }, [useSelfGradedAnswer]);

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
    const autoplayKey = `word:${item.id}:${item.audio_url || ""}:${targetPromptMode}`;
    if (!shouldAutoplayPrompt(autoplayKey)) {
      return;
    }
    playPromptAudio();
  }, [targetPromptMode, item.id, item.audio_url, allowPromptAudio]);

  useEffect(() => {
    setAnswer("");
    setFeedback("");
    setHintLetter("");
    setHintStepsUsed(0);
    setAwaitingWrongAccept(false);
    setAnswerRevealed(false);
    setLetterSuggestions([]);
  }, [item.id, item.direction]);

  if (useSelfGradedAnswer) {
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
        {answerRevealed && (
          <p className="revealed-answer">
            <span>{t("review.answerLabel")}</span> {expectedAnswer}
          </p>
        )}
        <div className="actions">
          {!answerRevealed ? (
            <>
              {onOpenItem ? (
                <button type="button" className="secondary-button" onClick={() => onOpenItem(item.id)}>
                  {t("words.openItem")}
                </button>
              ) : null}
              <button type="button" onClick={() => setAnswerRevealed(true)} disabled={isSubmitting}>
                {t("review.revealAnswer")}
              </button>
            </>
          ) : (
            <>
              {onOpenItem ? (
                <button type="button" className="secondary-button" onClick={() => onOpenItem(item.id)}>
                  {t("words.openItem")}
                </button>
              ) : null}
              <button type="button" className="item-got-it-button" onClick={() => void markSelfGradedAnswer(true)} disabled={isSubmitting}>
                {t("review.passed")}
              </button>
              <DangerousButton className="dangerous-primary-button" onConfirm={() => markSelfGradedAnswer(false)} disabled={isSubmitting}>
                {t("review.failed")}
              </DangerousButton>
            </>
          )}
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
        placeholder={t("word.input.placeholder")}
        data-testid="word-input"
        disabled={isSubmitting || awaitingWrongAccept}
        autoFocus
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />
      {feedback && <p className="word-input-feedback">{feedback}</p>}
      {letterSuggestions.length > 0 && (
        <div className="letter-suggestions" role="group" aria-label={t("word.letterSuggestions")}>
          {letterSuggestions.map((letter) => (
            <button
              key={letter}
              type="button"
              className="secondary-button letter-suggestion-button"
              onClick={() => handleAnswerChange(answer + letter)}
              disabled={isSubmitting || awaitingWrongAccept}
            >
              {letter}
            </button>
          ))}
        </div>
      )}
      <p className="hint">{hint ? t("word.hint", { letter: hint }) : "\u00a0"}</p>
      <div className="actions">
        {!awaitingWrongAccept && (
          <>
            {onOpenItem ? (
              <button type="button" className="secondary-button" onClick={() => onOpenItem(item.id)}>
                {t("words.openItem")}
              </button>
            ) : null}
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
            <DangerousButton className="dangerous-primary-button" onConfirm={failWrittenAnswer} disabled={isSubmitting}>
              {t("word.failButton")}
            </DangerousButton>
          </>
        )}
        {awaitingWrongAccept && (
          <button onClick={() => void acceptWrongAnswer()} disabled={isSubmitting}>
            {t("word.acceptButton")}
          </button>
        )}
      </div>
    </div>
  );
}
