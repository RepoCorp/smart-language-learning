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

function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function isSingleBaseLetterForNextDiacritic(value: string, acceptedAnswer: string, expectedAnswer: string): boolean {
  if (value.length !== acceptedAnswer.length + 1) {
    return false;
  }
  if (!value.startsWith(acceptedAnswer)) {
    return false;
  }
  const typedLetter = value.charAt(acceptedAnswer.length);
  const expectedLetter = expectedAnswer.charAt(acceptedAnswer.length);
  if (!isLetter(typedLetter) || !isLetter(expectedLetter)) {
    return false;
  }
  if (typedLetter === expectedLetter) {
    return false;
  }
  return stripDiacritics(expectedLetter).toLowerCase() === typedLetter.toLowerCase();
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

function blankTargetInPhrase(phrase: string, targetText: string): string {
  const normalizedPhrase = phrase.trim();
  const normalizedTarget = targetText.trim();
  if (!normalizedPhrase || !normalizedTarget) {
    return "";
  }
  const escapedTarget = normalizedTarget.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const letterClass = "A-Za-zÀ-ÖØ-öø-ÿ";
  const match = normalizedPhrase.match(new RegExp(`(^|[^${letterClass}])(${escapedTarget})(?=$|[^${letterClass}])`, "i"));
  if (!match || match.index === undefined) {
    return "";
  }
  const prefix = match[1] || "";
  const startIndex = match.index + prefix.length;
  return `${normalizedPhrase.slice(0, startIndex)}____${normalizedPhrase.slice(startIndex + match[2].length)}`;
}

function dialogClozePhraseForItem(item: SessionItem): string {
  const matchedTurns = (item.related_dialogs || []).flatMap((dialog) => dialog.matched_turns);
  const dialogTurns = (item.related_dialogs || []).flatMap((dialog) => dialog.turns);
  const candidates = [
    ...matchedTurns.map((turn) => turn.target_text),
    ...dialogTurns.map((turn) => turn.target_text),
  ].filter((candidate) => candidate.trim() && candidate.trim().toLowerCase() !== item.german_text.trim().toLowerCase());
  for (const candidate of candidates) {
    const cloze = blankTargetInPhrase(candidate, item.german_text);
    if (cloze) {
      return cloze;
    }
  }
  return "";
}

function fallbackClozePhraseForItem(item: SessionItem): string {
  const candidates = [
    ...((item.exercise_phrases?.phrases || []).map((entry) => entry.target_text)),
    ...((item.exercise_phrases?.first_section || []).map((entry) => entry.target_text)),
    ...((item.exercise_phrases?.second_section || []).map((entry) => entry.target_text)),
    item.exercise_phrases?.funny_image_phrase?.target_text || "",
  ].filter((candidate) => candidate.trim() && candidate.trim().toLowerCase() !== item.german_text.trim().toLowerCase());
  for (const candidate of candidates) {
    const cloze = blankTargetInPhrase(candidate, item.german_text);
    if (cloze) {
      return cloze;
    }
  }
  return "";
}

function clozePhraseForItem(item: SessionItem): string {
  return dialogClozePhraseForItem(item) || fallbackClozePhraseForItem(item);
}

function advancePastFixedCharacters(value: string, expectedAnswer: string): string {
  let nextValue = value;
  while (nextValue.length < expectedAnswer.length && !isLetter(expectedAnswer.charAt(nextValue.length))) {
    nextValue += expectedAnswer.charAt(nextValue.length);
  }
  return nextValue;
}

function clozeLetterProgress(value: string, expectedAnswer: string): string {
  return expectedAnswer
    .split("")
    .map((letter, index) => {
      if (index < value.length) {
        return letter;
      }
      return isLetter(letter) ? "_" : letter;
    })
    .join("");
}

interface WordReviewProps {
  item: SessionItem;
  onAnswered: (correct: boolean) => Promise<void>;
  onOpenItem?: (itemId: number) => void;
}

const FEEDBACK_DELAY_MS = 1000;
type FeedbackTone = "neutral" | "success" | "error";

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
  const [feedbackTone, setFeedbackTone] = useState<FeedbackTone>("neutral");
  const [hintLetter, setHintLetter] = useState<string>("");
  const [hintStepsUsed, setHintStepsUsed] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [awaitingWrongAccept, setAwaitingWrongAccept] = useState<boolean>(false);
  const [showPromptText, setShowPromptText] = useState<boolean>(targetPromptMode === "text");
  const [answerRevealed, setAnswerRevealed] = useState<boolean>(false);
  const [letterSuggestions, setLetterSuggestions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const composingAnswerRef = useRef<boolean>(false);
  const answerBeforeCompositionRef = useRef<string>("");
  const pendingCompositionValidationRef = useRef<boolean>(false);
  const provisionalBaseAnswerRef = useRef<string | null>(null);

  const isSpanishToGerman = item.direction !== "de_to_es";
  const useSelfGradedAnswer = !isSpanishToGerman;
  const useIntroRetry = isSpanishToGerman && item.repeatPracticeStep === "word_intro";
  const useClozeRetry = isSpanishToGerman && Boolean(item.repeatedAfterFailure) && item.repeatPracticeStep !== "word_intro";
  const allowPromptAudio = !isSpanishToGerman;
  const promptText = isSpanishToGerman ? item.spanish_text : item.german_text;
  const expectedAnswer = isSpanishToGerman ? item.german_text : item.spanish_text;
  const clozePhrase = useClozeRetry ? clozePhraseForItem(item) : "";
  const clozeNextLetter = useClozeRetry ? expectedAnswer.charAt(answer.length) : "";
  const clozeLetterSuggestions = useClozeRetry ? nextLetterSuggestions(clozeNextLetter, answer.length) : [];
  const clozeProgress = useClozeRetry ? clozeLetterProgress(answer, expectedAnswer) : "";
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
    setFeedbackTone(correct ? "success" : "error");
    try {
      await new Promise((resolve) => setTimeout(resolve, FEEDBACK_DELAY_MS));
      await onAnswered(correct);
    } finally {
      setIsSubmitting(false);
    }
  };

  const requireWrongAccept = (message: string): void => {
    setFeedback(message);
    setFeedbackTone("error");
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

  const handleAnswerChange = (value: string, acceptedAnswer = answer): void => {
    if (useSelfGradedAnswer) {
      return;
    }
    if (isSubmitting) {
      return;
    }

    if (!expectedAnswer.startsWith(value)) {
      if (isSingleBaseLetterForNextDiacritic(value, acceptedAnswer, expectedAnswer)) {
        provisionalBaseAnswerRef.current = acceptedAnswer;
        setAnswer(value);
        setFeedback("");
        setFeedbackTone("neutral");
        setLetterSuggestions([]);
        setHintLetter("");
        setAwaitingWrongAccept(false);
        return;
      }
      const fallbackAnswer = provisionalBaseAnswerRef.current && acceptedAnswer.startsWith(provisionalBaseAnswerRef.current)
        ? provisionalBaseAnswerRef.current
        : acceptedAnswer;
      const wrongText = value.slice(acceptedAnswer.length) || value.slice(fallbackAnswer.length) || value.slice(-1);
      setAnswer(fallbackAnswer);
      setFeedback(t("word.feedback.wrongLetter", { letter: wrongText }));
      setFeedbackTone("error");
      setLetterSuggestions(nextLetterSuggestions(expectedAnswer.charAt(fallbackAnswer.length), fallbackAnswer.length));
      return;
    }

    provisionalBaseAnswerRef.current = null;
    setAnswer(value);
    setFeedback("");
    setFeedbackTone("neutral");
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

  const chooseClozeLetter = async (letter: string): Promise<void> => {
    if (!useClozeRetry || isSubmitting || awaitingWrongAccept) {
      return;
    }
    if (letter !== clozeNextLetter) {
      setFeedback(t("word.feedback.wrongLetter", { letter }));
      setFeedbackTone("error");
      return;
    }
    const nextAnswer = advancePastFixedCharacters(answer + letter, expectedAnswer);
    setAnswer(nextAnswer);
    setFeedback("");
    setFeedbackTone("neutral");
    if (normalize(nextAnswer) === normalize(expectedAnswer)) {
      await submitWithFeedback(true, t("word.feedback.correct"));
    }
  };

  const playPromptAudio = (): void => {
    if (!allowPromptAudio || !item.audio_url) {
      return;
    }
    const audio = new Audio(item.audio_url);
    void audio.play().catch(() => {});
  };

  const continueIntroRetry = async (): Promise<void> => {
    if (isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    try {
      await onAnswered(true);
    } finally {
      setIsSubmitting(false);
    }
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
    setFeedbackTone("neutral");
    setHintLetter("");
    setHintStepsUsed(0);
    setAwaitingWrongAccept(false);
    setAnswerRevealed(false);
    setLetterSuggestions([]);
    composingAnswerRef.current = false;
    pendingCompositionValidationRef.current = false;
    answerBeforeCompositionRef.current = "";
    provisionalBaseAnswerRef.current = null;
    if (item.repeatPracticeStep === "word_cloze") {
      setAnswer(advancePastFixedCharacters("", item.german_text));
    }
  }, [item.id, item.direction, item.repeatPracticeStep, item.german_text]);

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
          <>
            <p className="prompt prompt-light test-instruction">{t("phrase.promptInstruction", { language: languageLabel })}</p>
            <p className="test-source-phrase">{promptText}</p>
          </>
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
        {feedback && <p className={`word-input-feedback word-input-feedback-${feedbackTone}`}>{feedback}</p>}
      </div>
    );
  }

  if (useIntroRetry) {
    return (
      <div>
        <div className="actions">
          {onOpenItem ? (
            <button type="button" className="secondary-button" onClick={() => onOpenItem(item.id)}>
              {t("words.openItem")}
            </button>
          ) : null}
          <button type="button" onClick={() => void continueIntroRetry()} disabled={isSubmitting}>
            {t("review.continue")}
          </button>
        </div>
      </div>
    );
  }

  if (useClozeRetry) {
    return (
      <div>
        <p className="prompt prompt-light test-instruction">{t("word.clozePromptInstruction")}</p>
        <p className="test-source-phrase">{item.spanish_text}</p>
        <p className="word-cloze-phrase">
          {clozePhrase || t("word.clozeMissingPhrase")}
        </p>
        {clozePhrase && (
          <>
            <p className="word-letter-progress" aria-label={t("word.letterBuildLabel")}>
              {clozeProgress}
            </p>
            {clozeLetterSuggestions.length > 0 && (
              <div className="letter-suggestions word-cloze-letter-options" role="group" aria-label={t("word.letterSuggestions")}>
                {clozeLetterSuggestions.map((letter) => (
                  <button
                    key={letter}
                    type="button"
                    className="secondary-button letter-suggestion-button word-cloze-letter-button"
                    onClick={() => void chooseClozeLetter(letter)}
                    disabled={isSubmitting}
                  >
                    {letter}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
        {feedback && <p className={`word-input-feedback word-input-feedback-${feedbackTone}`}>{feedback}</p>}
        <div className="actions">
          {onOpenItem ? (
            <button type="button" className="secondary-button" onClick={() => onOpenItem(item.id)}>
              {t("words.openItem")}
            </button>
          ) : null}
          {clozePhrase ? (
            <DangerousButton className="dangerous-primary-button" onConfirm={failWrittenAnswer} disabled={isSubmitting}>
              {t("word.failButton")}
            </DangerousButton>
          ) : (
            <button type="button" onClick={() => void continueIntroRetry()} disabled={isSubmitting}>
              {t("review.continue")}
            </button>
          )}
        </div>
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
        <>
          <p className="prompt prompt-light test-instruction">{t("word.promptInstruction", { language: languageLabel })}</p>
          <p className="test-source-phrase">{promptText}</p>
        </>
      )}
      <input
        ref={inputRef}
        className={answer ? "word-input-correct-progress" : ""}
        value={answer}
        onCompositionStart={() => {
          composingAnswerRef.current = true;
          answerBeforeCompositionRef.current = answer;
        }}
        onCompositionEnd={(event) => {
          composingAnswerRef.current = false;
          pendingCompositionValidationRef.current = true;
          const acceptedAnswer = answerBeforeCompositionRef.current;
          const compositionEndValue = event.currentTarget.value;
          window.setTimeout(() => {
            if (!pendingCompositionValidationRef.current) {
              return;
            }
            pendingCompositionValidationRef.current = false;
            handleAnswerChange(compositionEndValue || inputRef.current?.value || "", acceptedAnswer);
          }, 0);
        }}
        onChange={(e) => {
          const nativeEvent = e.nativeEvent as InputEvent;
          if (composingAnswerRef.current || nativeEvent.isComposing) {
            setAnswer(e.target.value);
            return;
          }
          if (pendingCompositionValidationRef.current) {
            pendingCompositionValidationRef.current = false;
            handleAnswerChange(e.target.value, answerBeforeCompositionRef.current);
            return;
          }
          handleAnswerChange(e.target.value);
        }}
        placeholder={t("word.input.placeholder")}
        data-testid="word-input"
        disabled={isSubmitting || awaitingWrongAccept}
        autoFocus
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />
      {feedback && <p className={`word-input-feedback word-input-feedback-${feedbackTone}`}>{feedback}</p>}
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
