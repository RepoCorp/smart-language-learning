import { useEffect, useRef, useState } from "react";

import { shouldAutoplayPrompt, suppressPromptAutoplayForAudio } from "../audioAutoplayGuard";
import { deterministicSort } from "../deterministic";
import { useI18n } from "../i18n";
import { usePromptPreferences } from "../promptPreferences";
import { type StudyLanguageCode, useStudyLanguages } from "../studyLanguages";
import type { SessionItem } from "../types";
import DangerousButton from "./DangerousButton";
import InteractiveTargetPhrase from "./InteractiveTargetPhrase";

function normalize(value: string): string {
  return value.trim();
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

function normalizedSearchText(value: string): string {
  return stripDiacritics(value).toLowerCase().trim();
}

function targetWordSearchTerms(value: string): string[] {
  const ignoredTerms = new Set(["der", "die", "das", "ein", "eine", "einen", "einem", "einer"]);
  const normalizedValue = normalizedSearchText(value);
  const terms = normalizedValue
    .split(/[^a-zA-ZÀ-ÖØ-öø-ÿ]+/)
    .filter((part) => part.length > 1 && !ignoredTerms.has(part));
  return Array.from(new Set([normalizedValue, ...terms].filter(Boolean)));
}

function completionPhraseForItem(item: SessionItem): { text: string; sourceText: string; audioUrl: string } {
  const targetTerms = targetWordSearchTerms(item.german_text);
  if (!targetTerms.length) {
    return { text: "", sourceText: "", audioUrl: "" };
  }

  const containsTargetWord = (targetText: string): boolean => {
    const normalizedTarget = normalizedSearchText(targetText);
    return normalizedTarget.length > 0
      && !targetTerms.includes(normalizedTarget)
      && targetTerms.some((term) => normalizedTarget.includes(term));
  };
  const dialogTurnCandidates = (item.related_dialogs || []).flatMap((dialog) => dialog.turns.map((turn) => ({
    target: turn.target_text,
    source: turn.source_text,
    audioUrl: turn.phrase_audio_url || "",
  })));
  const matchedAudioTurn = (item.related_dialogs || []).flatMap((dialog) => dialog.matched_turns.map((turn) => {
    const relatedTurn = dialog.turns.find((entry, index) => index === turn.turn_index);
    return {
      target: relatedTurn?.target_text || turn.target_text || "",
      source: relatedTurn?.source_text || turn.source_text || "",
      audioUrl: relatedTurn?.phrase_audio_url || "",
    };
  })).find((candidate) => candidate.audioUrl && containsTargetWord(candidate.target));
  if (matchedAudioTurn) {
    return { text: matchedAudioTurn.target, sourceText: matchedAudioTurn.source, audioUrl: matchedAudioTurn.audioUrl };
  }

  const containingAudioTurn = dialogTurnCandidates.find((candidate) => candidate.audioUrl && containsTargetWord(candidate.target));
  if (containingAudioTurn) {
    return { text: containingAudioTurn.target, sourceText: containingAudioTurn.source, audioUrl: containingAudioTurn.audioUrl };
  }

  return { text: "", sourceText: "", audioUrl: "" };
}

function warmupContextPairForItem(item: SessionItem): { target: string; source: string } {
  const dialogCandidates = [
    ...((item.related_dialogs || []).flatMap((dialog) => dialog.matched_turns.map((turn) => ({
      source: turn.source_text,
      target: turn.target_text,
    })))),
    ...((item.related_dialogs || []).flatMap((dialog) => dialog.turns.map((turn) => ({
      source: turn.source_text,
      target: turn.target_text,
    })))),
  ];
  const exerciseCandidates = [
    ...((item.exercise_phrases?.phrases || []).map((entry) => ({
      source: entry.source_text,
      target: entry.target_text,
    }))),
    ...((item.exercise_phrases?.first_section || []).map((entry) => ({
      source: entry.source_text,
      target: entry.target_text,
    }))),
    ...((item.exercise_phrases?.second_section || []).map((entry) => ({
      source: entry.source_text,
      target: entry.target_text,
    }))),
    ...(item.exercise_phrases?.funny_image_phrase
      ? [{
        source: item.exercise_phrases.funny_image_phrase.source_text,
        target: item.exercise_phrases.funny_image_phrase.target_text,
      }]
      : []),
  ];
  const candidates = [...dialogCandidates, ...exerciseCandidates].filter(
    (candidate) => candidate.target.trim() && candidate.source.trim(),
  );
  return candidates.find((candidate) => blankTargetInPhrase(candidate.target, item.german_text)) || { target: "", source: "" };
}

function splitClozePhrase(phrase: string): { before: string; after: string } | null {
  const marker = "____";
  const markerIndex = phrase.indexOf(marker);
  if (markerIndex === -1) {
    return null;
  }
  return {
    before: phrase.slice(0, markerIndex),
    after: phrase.slice(markerIndex + marker.length),
  };
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

function warmupRevealOrderForValue(value: string, seed: string): number[] {
  const revealableIndices = value
    .split("")
    .map((letter, index) => ({ letter, index }))
    .filter(({ letter }) => isLetter(letter))
    .map(({ index }) => index);
  if (revealableIndices.length <= 1) {
    return revealableIndices;
  }
  const firstIndex = revealableIndices[0];
  const remaining = deterministicSort(
    revealableIndices.slice(1),
    seed,
    (entry, index) => `${value.charAt(entry)}:${entry}:${index}`,
  );
  return [...remaining, firstIndex];
}

function warmupProgress(value: string, revealedIndexes: Set<number>): string {
  return value
    .split("")
    .map((letter, index) => {
      if (!isLetter(letter)) {
        return letter;
      }
      return revealedIndexes.has(index) ? letter : "_";
    })
    .join("");
}

interface WordReviewProps {
  item: SessionItem;
  onAnswered: (correct: boolean) => Promise<void>;
  reviewComplete?: boolean;
  onNextItem?: () => Promise<void>;
}

function RevealedReviewSummary({
  itemId,
  answer,
  phrase,
  phraseTranslation,
}: {
  itemId: number;
  answer: string;
  phrase?: string;
  phraseTranslation?: string;
}): JSX.Element {
  return (
    <div className="revealed-answer">
      <p className="revealed-answer-main">{answer}</p>
      <InteractiveTargetPhrase
        className="conversation-line conversation-line-translation revealed-answer-phrase"
        sourceText={phraseTranslation || ""}
        targetText={phrase || answer}
        statusKeyPrefix={`review-${itemId}-phrase`}
      />
      <p className="revealed-answer-translation">{phraseTranslation || "\u2014"}</p>
    </div>
  );
}

const FEEDBACK_DELAY_MS = 1000;
type FeedbackTone = "neutral" | "success" | "error";

export default function WordReview({
  item,
  onAnswered,
  reviewComplete = false,
  onNextItem,
}: WordReviewProps): JSX.Element {
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
  const [submittedResultTone, setSubmittedResultTone] = useState<FeedbackTone>("neutral");
  const [hintLetter, setHintLetter] = useState<string>("");
  const [writtenWordAssistanceIndexes, setWrittenWordAssistanceIndexes] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showPromptText, setShowPromptText] = useState<boolean>(targetPromptMode === "text");
  const [answerRevealed, setAnswerRevealed] = useState<boolean>(false);
  const [letterSuggestions, setLetterSuggestions] = useState<string[]>([]);
  const [warmupRevealCount, setWarmupRevealCount] = useState<number>(0);
  const [completionPreview, setCompletionPreview] = useState<{ word: string; phrase: string; phraseTranslation: string } | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const completionAudioRef = useRef<HTMLAudioElement | null>(null);
  const composingAnswerRef = useRef<boolean>(false);
  const answerBeforeCompositionRef = useRef<string>("");
  const pendingCompositionValidationRef = useRef<boolean>(false);
  const provisionalBaseAnswerRef = useRef<string | null>(null);
  const pendingRewriteFocusRef = useRef<boolean>(false);

  const isSpanishToGerman = item.direction !== "de_to_es";
  const useSelfGradedAnswer = !isSpanishToGerman;
  const useIntroRetry = isSpanishToGerman && item.repeatPracticeStep === "word_intro";
  const useClozeRetry = isSpanishToGerman && Boolean(item.repeatedAfterFailure) && item.repeatPracticeStep !== "word_intro";
  const allowPromptAudio = !isSpanishToGerman;
  const promptText = isSpanishToGerman ? item.spanish_text : item.german_text;
  const expectedAnswer = isSpanishToGerman ? item.german_text : item.spanish_text;
  const targetWordText = item.german_text;
  const clozePhrase = useClozeRetry ? clozePhraseForItem(item) : "";
  const clozeNextLetter = useClozeRetry ? expectedAnswer.charAt(answer.length) : "";
  const clozeLetterSuggestions = useClozeRetry ? nextLetterSuggestions(clozeNextLetter, answer.length) : [];
  const clozeProgress = useClozeRetry ? clozeLetterProgress(answer, expectedAnswer) : "";
  const completedClozePhrase = useClozeRetry && normalize(answer) === normalize(expectedAnswer);
  const clozePhraseParts = useClozeRetry ? splitClozePhrase(clozePhrase) : null;
  const warmupRevealOrder = useIntroRetry
    ? warmupRevealOrderForValue(expectedAnswer, `${item.id}:${expectedAnswer}:${item.direction || ""}:warmup`)
    : [];
  const warmupRevealedIndexes = new Set(warmupRevealOrder.slice(0, warmupRevealCount));
  const warmupProgressText = useIntroRetry ? warmupProgress(expectedAnswer, warmupRevealedIndexes) : "";
  const warmupContextPair = useIntroRetry ? warmupContextPairForItem(item) : { target: "", source: "" };
  const warmupContextSentence = warmupContextPair.target;
  const warmupContextTranslation = warmupContextPair.source;
  const warmupContextParts = useIntroRetry ? splitClozePhrase(blankTargetInPhrase(warmupContextSentence, expectedAnswer)) : null;
  const warmupAllLettersRevealed = useIntroRetry && warmupRevealCount >= warmupRevealOrder.length;
  const warmupInputIsWrong = useIntroRetry && Boolean(answer) && !expectedAnswer.startsWith(answer);
  const warmupInputIsCorrect = useIntroRetry && normalize(answer) === normalize(expectedAnswer);
  const showWarmupTranslation = useIntroRetry && Boolean(warmupContextTranslation) && (warmupInputIsCorrect || warmupAllLettersRevealed);
  const completionPhrase = completionPhraseForItem(item);
  const languageLabel = isSpanishToGerman
    ? t(languageKeyByCode[targetLanguage])
    : t(languageKeyByCode[sourceLanguage]);

  const hint = hintLetter;
  const hidePromptText = targetPromptMode === "audio" && allowPromptAudio && !showPromptText;
  const totalWrittenWordAssistanceSteps = writtenWordAssistanceIndexes.length;
  const hasWrittenWordMistake = (): boolean => totalWrittenWordAssistanceSteps > 0;
  const submittedInputClassName = submittedResultTone === "error"
    ? "word-input-error-progress"
    : submittedResultTone === "success"
      ? "word-input-correct-progress"
      : "";

  const waitForPreviewPaint = async (): Promise<void> => {
    if (typeof window === "undefined") {
      return;
    }
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => window.setTimeout(resolve, 0)));
  };

  const playAudioUrl = async (audioUrl: string): Promise<boolean> => {
    if (!audioUrl) {
      return false;
    }
    const audio = completionAudioRef.current || new Audio();
    completionAudioRef.current = audio;
    audio.pause();
    audio.currentTime = 0;
    audio.src = audioUrl;
    suppressPromptAutoplayForAudio(audio);
    return await new Promise<boolean>((resolve) => {
      let started = false;
      const finish = (): void => resolve(started);
      audio.onended = finish;
      audio.onerror = finish;
      audio.onabort = finish;
      audio.load();
      void audio.play()
        .then(() => {
          started = true;
        })
        .catch(() => resolve(false));
    });
  };

  const playCompletionAudio = async (): Promise<boolean> => {
    let playedAny = false;
    if (await playAudioUrl(item.audio_url || "")) {
      playedAny = true;
    }
    if (completionPhrase.audioUrl) {
      if (await playAudioUrl(completionPhrase.audioUrl)) {
        playedAny = true;
      }
    }
    return playedAny;
  };

  const showTargetCompletionPreview = (): boolean => {
    if (!targetWordText && !completionPhrase.text) {
      return false;
    }
    setCompletionPreview({
      word: targetWordText,
      phrase: completionPhrase.text,
      phraseTranslation: completionPhrase.sourceText,
    });
    return true;
  };

  const submitWithFeedback = async (
    correct: boolean,
    message: string,
    options?: { preserveExistingFeedback?: boolean },
  ): Promise<void> => {
    setIsSubmitting(true);
    if (!options?.preserveExistingFeedback) {
      setFeedback(message);
      setFeedbackTone(correct ? "success" : "error");
    }
    setSubmittedResultTone(correct ? "success" : "error");
    const showingPreview = showTargetCompletionPreview();
    try {
      if (showingPreview) {
        await waitForPreviewPaint();
      }
      const played = await playCompletionAudio();
      if (!played) {
        await new Promise((resolve) => setTimeout(resolve, FEEDBACK_DELAY_MS));
      }
      await onAnswered(correct);
    } finally {
      setIsSubmitting(false);
    }
  };

  const markSelfGradedAnswer = async (correct: boolean): Promise<void> => {
    if (!useSelfGradedAnswer || isSubmitting || !answerRevealed) {
      return;
    }
    await submitWithFeedback(correct, correct ? t("word.feedback.correct") : "");
  };

  const failWrittenAnswer = async (): Promise<void> => {
    if (useSelfGradedAnswer || isSubmitting) {
      return;
    }
    clearAnswerAndRefocus();
    setHintLetter("");
    setLetterSuggestions([]);
    setFeedback(t("word.feedback.rewritePrompt"));
    setFeedbackTone("neutral");
    setSubmittedResultTone("error");
    await submitWithFeedback(false, "", { preserveExistingFeedback: true });
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
    const nextSuggestions = nextHintLetter
      ? nextLetterSuggestions(nextHintLetter, prefixLen)
      : [];
    setHintLetter("");
    setLetterSuggestions(nextSuggestions);
    if (nextHintLetter) {
      setWrittenWordAssistanceIndexes((current) => (current.includes(prefixLen) ? current : [...current, prefixLen]));
    }
  };

  const handleHintButtonPress = (): void => {
    showInputAwareHint();
    window.setTimeout(() => {
      inputRef.current?.focus({ preventScroll: true });
    }, 0);
  };

  const clearAnswerAndRefocus = (): void => {
    setAnswer("");
    pendingRewriteFocusRef.current = true;
  };

  const handleAnswerChange = (value: string, acceptedAnswer = answer): void => {
    if (useSelfGradedAnswer) {
      return;
    }
    if (isSubmitting) {
      return;
    }
    if (reviewComplete) {
      setAnswer(value);
      setHintLetter("");
      setLetterSuggestions([]);
      if (normalize(value) === normalize(expectedAnswer)) {
        setFeedback("");
        setFeedbackTone("neutral");
        setSubmittedResultTone("success");
      } else {
        setFeedback(t("word.feedback.rewritePrompt"));
        setFeedbackTone("neutral");
        setSubmittedResultTone("error");
      }
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
        return;
      }
      const fallbackAnswer = provisionalBaseAnswerRef.current && acceptedAnswer.startsWith(provisionalBaseAnswerRef.current)
        ? provisionalBaseAnswerRef.current
        : acceptedAnswer;
      const maxCompareLength = Math.min(value.length, expectedAnswer.length);
      let mismatchIndex = 0;
      while (mismatchIndex < maxCompareLength && value.charAt(mismatchIndex) === expectedAnswer.charAt(mismatchIndex)) {
        mismatchIndex += 1;
      }
      if (mismatchIndex >= maxCompareLength) {
        mismatchIndex = fallbackAnswer.length;
      }
      const wrongText = value.slice(acceptedAnswer.length) || value.slice(fallbackAnswer.length) || value.slice(-1);
      setAnswer(fallbackAnswer);
      setFeedback(t("word.feedback.wrongLetter", { letter: wrongText }));
      setFeedbackTone("error");
      setLetterSuggestions([]);
      setHintLetter("");
      setWrittenWordAssistanceIndexes((current) => (current.includes(mismatchIndex) ? current : [...current, mismatchIndex]));
      return;
    }

    provisionalBaseAnswerRef.current = null;
    setAnswer(value);
    setFeedback("");
    setFeedbackTone("neutral");
    setLetterSuggestions([]);
    setHintLetter("");

    if (normalize(value) !== normalize(expectedAnswer)) {
      return;
    }

    if (hasWrittenWordMistake()) {
      clearAnswerAndRefocus();
      setHintLetter("");
      setLetterSuggestions([]);
      setFeedback(t("word.feedback.rewritePrompt"));
      setFeedbackTone("neutral");
      setSubmittedResultTone("error");
      void submitWithFeedback(false, "", { preserveExistingFeedback: true });
      return;
    }
    void submitWithFeedback(true, t("word.feedback.correct"));
  };

  const chooseClozeLetter = async (letter: string): Promise<void> => {
    if (!useClozeRetry || isSubmitting) {
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

  const revealNextWarmupLetter = (): void => {
    if (!useIntroRetry || isSubmitting) {
      return;
    }
    setWarmupRevealCount((current) => {
      const nextCount = Math.min(current + 1, warmupRevealOrder.length);
      if (nextCount >= warmupRevealOrder.length && normalize(answer) !== normalize(expectedAnswer)) {
        setFeedback(t("word.warmupAllLettersShown", { answer: expectedAnswer }));
        setFeedbackTone("error");
      }
      return nextCount;
    });
  };

  const handleWarmupAnswerChange = (value: string): void => {
    if (!useIntroRetry || isSubmitting) {
      return;
    }
    setAnswer(value);
    if (warmupAllLettersRevealed && normalize(value) !== normalize(expectedAnswer)) {
      setFeedback(t("word.warmupAllLettersShown", { answer: expectedAnswer }));
      setFeedbackTone("error");
    } else {
      setFeedback("");
      setFeedbackTone("neutral");
    }
    if (normalize(value) !== normalize(expectedAnswer)) {
      return;
    }
    const warmupSuccessMessage = warmupRevealCount === 0
      ? t("word.warmupPerfect")
      : warmupRevealCount <= 2
        ? t("word.warmupAlmostPerfect")
        : t("word.feedback.correct");
    void submitWithFeedback(true, warmupSuccessMessage);
  };

  const playPromptAudio = (): void => {
    if (!allowPromptAudio || !item.audio_url) {
      return;
    }
    const audio = new Audio(item.audio_url);
    void audio.play().catch(() => {});
  };

  const continueSuccessfulRetry = async (): Promise<void> => {
    if (isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    try {
      await playCompletionAudio();
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
    if (!pendingRewriteFocusRef.current || isSubmitting) {
      return;
    }
    pendingRewriteFocusRef.current = false;
    window.setTimeout(() => {
      inputRef.current?.focus({ preventScroll: true });
    }, 0);
  }, [isSubmitting]);

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
    setSubmittedResultTone("neutral");
    setHintLetter("");
    setWrittenWordAssistanceIndexes([]);
    setAnswerRevealed(false);
    setLetterSuggestions([]);
    setWarmupRevealCount(0);
    setCompletionPreview(null);
    composingAnswerRef.current = false;
    pendingCompositionValidationRef.current = false;
    answerBeforeCompositionRef.current = "";
    provisionalBaseAnswerRef.current = null;
    if (completionAudioRef.current) {
      completionAudioRef.current.pause();
      completionAudioRef.current.src = "";
    }
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
          <RevealedReviewSummary
            itemId={item.id}
            answer={expectedAnswer}
            phrase={completionPreview?.phrase}
            phraseTranslation={completionPreview?.phraseTranslation}
          />
        )}
        <div className="actions">
          {!answerRevealed ? (
            <>
              <button type="button" onClick={() => setAnswerRevealed(true)} disabled={isSubmitting}>
                {t("review.revealAnswer")}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="item-got-it-button" onClick={() => void markSelfGradedAnswer(true)} disabled={isSubmitting || reviewComplete}>
                {t("review.passed")}
              </button>
              <DangerousButton className="dangerous-primary-button" onConfirm={() => markSelfGradedAnswer(false)} disabled={isSubmitting || reviewComplete}>
                {t("review.failed")}
              </DangerousButton>
              <button type="button" onClick={() => void onNextItem?.()} disabled={!reviewComplete || isSubmitting}>
                {t("session.nextItem")}
              </button>
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
        <p className="prompt prompt-light test-instruction">{t("word.warmupPromptInstruction")}</p>
        {warmupContextSentence && (
          <p className="word-warmup-context">
            {warmupContextParts
              ? (
                <>
                  {warmupContextParts.before}
                  <span className="word-warmup-context-answer" aria-label={t("word.letterBuildLabel")}>
                    {warmupProgressText || expectedAnswer}
                  </span>
                  {warmupContextParts.after}
                </>
              )
              : warmupContextSentence}
          </p>
        )}
        {!warmupContextSentence && (
          <p className="word-warmup-progress" aria-label={t("word.letterBuildLabel")}>
            {warmupProgressText || expectedAnswer}
          </p>
        )}
        {showWarmupTranslation && (
          <p className="revealed-answer">
            <span>{t("word.warmupTranslationLabel")}</span> {warmupContextTranslation}
          </p>
        )}
        <input
          ref={inputRef}
          className={submittedResultTone === "error"
            ? "word-input-error-progress"
            : submittedResultTone === "success" || warmupInputIsCorrect
              ? "word-input-correct-progress"
              : warmupInputIsWrong
              ? "word-input-error-progress"
              : ""}
          value={answer}
          onCompositionStart={() => {
            composingAnswerRef.current = true;
            answerBeforeCompositionRef.current = answer;
          }}
          onCompositionEnd={(event) => {
            composingAnswerRef.current = false;
            pendingCompositionValidationRef.current = true;
            const compositionEndValue = event.currentTarget.value;
            window.setTimeout(() => {
              if (!pendingCompositionValidationRef.current) {
                return;
              }
              pendingCompositionValidationRef.current = false;
              handleWarmupAnswerChange(compositionEndValue || inputRef.current?.value || "");
            }, 0);
          }}
          onChange={(event) => {
            const nativeEvent = event.nativeEvent as InputEvent;
            if (composingAnswerRef.current || nativeEvent.isComposing) {
              setAnswer(event.target.value);
              return;
            }
            if (pendingCompositionValidationRef.current) {
              pendingCompositionValidationRef.current = false;
              handleWarmupAnswerChange(event.target.value);
              return;
            }
            handleWarmupAnswerChange(event.target.value);
          }}
          placeholder={t("word.input.placeholder")}
          data-testid="word-input"
          disabled={isSubmitting}
          autoFocus
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
        {feedback && <p className={`word-input-feedback word-input-feedback-${feedbackTone}`}>{feedback}</p>}
        {completionPreview && (
          <RevealedReviewSummary
            itemId={item.id}
            answer={completionPreview.word}
            phrase={completionPreview.phrase}
            phraseTranslation={completionPreview.phraseTranslation}
          />
        )}
        <div className="actions">
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onPointerDown={(event) => event.preventDefault()}
            onTouchStart={(event) => event.preventDefault()}
            onClick={revealNextWarmupLetter}
            disabled={isSubmitting || reviewComplete || warmupRevealCount >= warmupRevealOrder.length}
          >
            {t("word.warmupRevealButton")}
          </button>
          <DangerousButton className="dangerous-primary-button" onConfirm={failWrittenAnswer} disabled={isSubmitting || reviewComplete}>
            {t("word.failButton")}
          </DangerousButton>
          <button type="button" onClick={() => void onNextItem?.()} disabled={!reviewComplete || isSubmitting}>
            {t("session.nextItem")}
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
          {clozePhraseParts
            ? (
              <>
                {clozePhraseParts.before}
                {completedClozePhrase
                  ? <span className="word-cloze-answer-filled">{expectedAnswer}</span>
                  : <span className="word-cloze-answer-progress">{clozeProgress || "____"}</span>}
                {clozePhraseParts.after}
              </>
            )
            : (clozePhrase || t("word.clozeMissingPhrase"))}
        </p>
        {clozePhrase && !completedClozePhrase && (
          <>
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
        {completionPreview && (
          <RevealedReviewSummary
            itemId={item.id}
            answer={completionPreview.word}
            phrase={completionPreview.phrase}
            phraseTranslation={completionPreview.phraseTranslation}
          />
        )}
        <div className="actions">
          {clozePhrase ? (
            <DangerousButton className="dangerous-primary-button" onConfirm={failWrittenAnswer} disabled={isSubmitting || reviewComplete}>
              {t("word.failButton")}
            </DangerousButton>
          ) : (
            <button type="button" onClick={() => void continueSuccessfulRetry()} disabled={isSubmitting || reviewComplete}>
              {t("review.continue")}
            </button>
          )}
          <button type="button" onClick={() => void onNextItem?.()} disabled={!reviewComplete || isSubmitting}>
            {t("session.nextItem")}
          </button>
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
        className={submittedInputClassName}
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
        disabled={isSubmitting}
        autoFocus
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />
      {feedback && <p className={`word-input-feedback word-input-feedback-${feedbackTone}`}>{feedback}</p>}
      {completionPreview && (
        <RevealedReviewSummary
          itemId={item.id}
          answer={completionPreview.word}
          phrase={completionPreview.phrase}
          phraseTranslation={completionPreview.phraseTranslation}
        />
      )}
      {letterSuggestions.length > 0 && (
        <div className="letter-suggestions" role="group" aria-label={t("word.letterSuggestions")}>
          {letterSuggestions.map((letter) => (
            <button
              key={letter}
              type="button"
              className="secondary-button letter-suggestion-button"
              onClick={() => handleAnswerChange(answer + letter)}
              disabled={isSubmitting}
            >
              {letter}
            </button>
          ))}
        </div>
      )}
      <p className="hint">{hint ? t("word.hint", { letter: hint }) : "\u00a0"}</p>
      <p className="hint" data-testid="word-hint-count">{t("word.hintCount", { count: totalWrittenWordAssistanceSteps })}</p>
      <div className="actions">
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onPointerDown={(event) => event.preventDefault()}
          onTouchStart={(event) => event.preventDefault()}
          onClick={handleHintButtonPress}
          disabled={isSubmitting || reviewComplete}
        >
          {t("word.hintButton")}
        </button>
        <DangerousButton className="dangerous-primary-button" onConfirm={failWrittenAnswer} disabled={isSubmitting || reviewComplete}>
          {t("word.failButton")}
        </DangerousButton>
        <button type="button" onClick={() => void onNextItem?.()} disabled={!reviewComplete || isSubmitting}>
          {t("session.nextItem")}
        </button>
      </div>
    </div>
  );
}
