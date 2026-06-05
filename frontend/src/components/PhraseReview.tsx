import { useEffect, useMemo, useRef, useState } from "react";

import { beginPromptAutoplaySuppression, shouldAutoplayPrompt, suppressPromptAutoplayForAudio } from "../audioAutoplayGuard";
import { deterministicSort } from "../deterministic";
import { useI18n } from "../i18n";
import { usePromptPreferences } from "../promptPreferences";
import { type StudyLanguageCode, useStudyLanguages } from "../studyLanguages";
import type { SessionItem } from "../types";
import DangerousButton from "./DangerousButton";
import DialogTurnText from "./DialogTurnText";

type ActionStatus = "idle" | "saving" | "added" | "exists" | "error";

interface PhraseReviewProps {
  item: SessionItem;
  onAnswered: (correct: boolean) => Promise<void>;
  onOpenItem?: (itemId: number) => void;
  targetWordStatus?: Record<string, ActionStatus>;
  onTargetWordClick?: (statusKey: string, token: string, tokenIndex: number) => void;
}

const FEEDBACK_DELAY_MS = 2000;

type PhraseToken = {
  id: string;
  text: string;
  originalIndex: number;
};

type DragPosition = {
  left: number;
  top: number;
};

type DragRect = DragPosition & {
  right: number;
  bottom: number;
  width: number;
  height: number;
};

function phraseTokens(value: string): PhraseToken[] {
  return value
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .map((part, index) => ({
      id: `${index}-${part}`,
      text: part,
      originalIndex: index,
    }));
}

function shufflePhraseTokens(tokens: PhraseToken[], seed: string): PhraseToken[] {
  if (tokens.length < 2) {
    return tokens;
  }
  const shuffled = deterministicSort(tokens, seed, (token) => `${token.id}:${token.text}`);
  const keptOriginalOrder = shuffled.every((token, index) => token.originalIndex === index);
  return keptOriginalOrder ? [...shuffled].reverse() : shuffled;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function smoothstep(value: number): number {
  const clamped = clamp(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}

function speakerForTurn(speaker: string | undefined, index: number): "a" | "b" {
  return speaker === "a" || speaker === "b" ? speaker : (index % 2 === 0 ? "a" : "b");
}

const speechLangByCode: Record<StudyLanguageCode, string> = {
  spanish: "es-ES",
  english: "en-US",
  german: "de-DE",
  french: "fr-FR",
  italian: "it-IT",
  portuguese: "pt-PT",
};

export default function PhraseReview({ item, onAnswered, onOpenItem, targetWordStatus = {}, onTargetWordClick }: PhraseReviewProps): JSX.Element {
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
  const [feedback, setFeedback] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showPromptText, setShowPromptText] = useState<boolean>(targetPromptMode === "text");
  const [answerRevealed, setAnswerRevealed] = useState<boolean>(false);
  const [placedPhraseTokens, setPlacedPhraseTokens] = useState<PhraseToken[]>([]);
  const [wrongPhraseTokenId, setWrongPhraseTokenId] = useState<string>("");
  const [draggingPhraseTokenId, setDraggingPhraseTokenId] = useState<string>("");
  const [draggingPhraseTokenPosition, setDraggingPhraseTokenPosition] = useState<{ left: number; top: number } | null>(null);
  const [activeLatchSlotIndex, setActiveLatchSlotIndex] = useState<number | null>(null);
  const [phraseBuilderComplete, setPhraseBuilderComplete] = useState<boolean>(false);
  const [selectedSituationChoiceIndex, setSelectedSituationChoiceIndex] = useState<number | null>(null);
  const [wrongSituationChoiceIndexes, setWrongSituationChoiceIndexes] = useState<number[]>([]);
  const draggingPhraseTokenIdRef = useRef<string>("");
  const phraseSlotsRef = useRef<HTMLDivElement | null>(null);
  const placedPhraseTokenCountRef = useRef<number>(0);
  const phraseBuilderCompleteRef = useRef<boolean>(false);
  const isSubmittingRef = useRef<boolean>(false);
  const phraseBuilderCompletionAudioPlayedRef = useRef<boolean>(false);
  const activePointerIdRef = useRef<number | null>(null);
  const activeLatchSlotIndexRef = useRef<number | null>(null);
  const placedTokenVoiceRef = useRef<string>("");
  const pendingPlacedTokenAudioTimeoutRef = useRef<number | null>(null);
  const pointerDragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const draggingPhraseTokenSizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const isSpanishToGerman = item.direction !== "de_to_es";
  const allowPromptAudio = !isSpanishToGerman;
  const promptText = isSpanishToGerman ? item.spanish_text : item.german_text;
  const expectedAnswer = isSpanishToGerman ? item.german_text : item.spanish_text;
  const itemDeterministicKey = `${item.item_type}:${item.spanish_text.trim().toLowerCase()}=>${item.german_text.trim().toLowerCase()}`;
  const expectedPhraseTokens = useMemo(() => phraseTokens(expectedAnswer), [expectedAnswer]);
  const phraseBuilderTokens = useMemo(
    () => shufflePhraseTokens(expectedPhraseTokens, `phrase-builder:${itemDeterministicKey}`),
    [expectedPhraseTokens, itemDeterministicKey],
  );
  const situationExpectedAnswer = (item.dialog_phrase_answer || "").trim();
  const situationTurns = useMemo(
    () => (
      item.dialog_phrase_turns?.length
        ? item.dialog_phrase_turns
        : (item.dialog_phrase_options || []).map((targetText, index) => ({
          source_text: "",
          target_text: targetText,
          speaker: index % 2 === 0 ? "a" : "b",
        }))
    ),
    [item.dialog_phrase_options, item.dialog_phrase_turns],
  );
  const situationSceneAudioUrls = (item.dialog_phrase_scene_audio_urls || []).filter((audioUrl) => audioUrl.trim().length > 0);
  const situationOddIndex = item.dialog_phrase_odd_index ?? null;
  const languageLabel = isSpanishToGerman
    ? t(languageKeyByCode[targetLanguage])
    : t(languageKeyByCode[sourceLanguage]);
  const hidePromptText = targetPromptMode === "audio" && allowPromptAudio && !showPromptText;
  const useRepeatPlaceholder = Boolean(item.repeatedAfterFailure);
  const usePhraseBuilder = useRepeatPlaceholder && (item.repeatPracticeStep === "phrase_builder" || (!item.repeatPracticeStep && isSpanishToGerman));
  const useSituationReview = useRepeatPlaceholder && (item.repeatPracticeStep === "phrase_dialog_match" || (!item.repeatPracticeStep && !isSpanishToGerman));
  const shouldSuppressPromptAudio = useSituationReview;

  const playPromptAudio = (): void => {
    if (!allowPromptAudio || !item.audio_url || shouldSuppressPromptAudio) {
      return;
    }
    const audio = new Audio(item.audio_url);
    void audio.play().catch(() => {});
  };

  const playPhraseAudio = async (): Promise<boolean> => {
    if (!item.audio_url) {
      return false;
    }
    const audio = new Audio(item.audio_url);
    suppressPromptAutoplayForAudio(audio);
    await new Promise<void>((resolve) => {
      const finish = (): void => resolve();
      audio.onended = finish;
      audio.onerror = finish;
      audio.onabort = finish;
      void audio.play().catch(finish);
    });
    return true;
  };

  const continueWithCompletionAudio = async (): Promise<void> => {
    if (isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    try {
      await playPhraseAudio();
      await onAnswered(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const playPlacedPhraseTokenAudio = (tokenText: string, playFullPhraseAfter = false): void => {
    const trimmedTokenText = tokenText.trim();
    if (!trimmedTokenText) {
      if (playFullPhraseAfter) {
        void playPhraseAudio();
      }
      return;
    }
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      if (playFullPhraseAfter) {
        void playPhraseAudio();
      }
      return;
    }
    window.speechSynthesis.cancel();
    window.speechSynthesis.resume();
    const utterance = new SpeechSynthesisUtterance(trimmedTokenText);
    const lang = speechLangByCode[targetLanguage] || "de-DE";
    const langPrefix = lang.split("-")[0];
    utterance.lang = lang;
    utterance.rate = 0.7;
    const matchingVoices = window.speechSynthesis
      .getVoices()
      .filter((voice) => voice.lang.toLowerCase().startsWith(langPrefix.toLowerCase()));
    const selectedVoice = matchingVoices.find((voice) => voice.voiceURI === placedTokenVoiceRef.current)
      || matchingVoices[0];
    if (selectedVoice) {
      utterance.voice = selectedVoice;
      placedTokenVoiceRef.current = selectedVoice.voiceURI;
    }
    if (playFullPhraseAfter) {
      utterance.onend = () => { void playPhraseAudio(); };
      utterance.onerror = () => { void playPhraseAudio(); };
    }
    window.speechSynthesis.speak(utterance);
  };

  const schedulePlacedPhraseTokenAudio = (tokenText: string, playFullPhraseAfter = false): void => {
    if (pendingPlacedTokenAudioTimeoutRef.current !== null) {
      window.clearTimeout(pendingPlacedTokenAudioTimeoutRef.current);
      pendingPlacedTokenAudioTimeoutRef.current = null;
    }
    pendingPlacedTokenAudioTimeoutRef.current = window.setTimeout(() => {
      pendingPlacedTokenAudioTimeoutRef.current = null;
      playPlacedPhraseTokenAudio(tokenText, playFullPhraseAfter);
    }, 80);
  };

  const playSituationScene = (): void => {
    if (!situationSceneAudioUrls.length) {
      return;
    }
    const releaseSuppression = beginPromptAutoplaySuppression(Math.max(2200, situationSceneAudioUrls.length * 2200));
    const playNext = (index: number): void => {
      const audioUrl = situationSceneAudioUrls[index];
      if (!audioUrl) {
        releaseSuppression();
        return;
      }
      const audio = new Audio(audioUrl);
      const finish = (): void => {
        if (index >= situationSceneAudioUrls.length - 1) {
          releaseSuppression();
          return;
        }
        playNext(index + 1);
      };
      audio.onended = finish;
      audio.onerror = finish;
      void audio.play().catch(finish);
    };
    playNext(0);
  };

  const submitWithFeedback = async (correct: boolean, message: string): Promise<void> => {
    if (isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    setFeedback(message);
    try {
      if (correct) {
        const played = await playPhraseAudio();
        if (!played) {
          await new Promise((resolve) => setTimeout(resolve, FEEDBACK_DELAY_MS));
        }
      } else {
        await new Promise((resolve) => setTimeout(resolve, FEEDBACK_DELAY_MS));
      }
      await onAnswered(correct);
    } finally {
      setIsSubmitting(false);
    }
  };

  const markSelfGradedAnswer = async (correct: boolean): Promise<void> => {
    if (isSubmitting || !answerRevealed) {
      return;
    }
    await submitWithFeedback(correct, correct ? t("phrase.feedback.correct") : t("phrase.feedback.markedWrong", { answer: expectedAnswer }));
  };

  const selectSituationChoice = (choiceIndex: number): void => {
    if (selectedSituationChoiceIndex !== null || isSubmitting) {
      return;
    }
    if (choiceIndex === situationOddIndex) {
      setSelectedSituationChoiceIndex(choiceIndex);
      playSituationScene();
      return;
    }
    setWrongSituationChoiceIndexes((current) => (
      current.includes(choiceIndex) ? current : [...current, choiceIndex]
    ));
  };

  const markWrongPhraseToken = (tokenId: string): void => {
    setWrongPhraseTokenId(tokenId);
    window.setTimeout(() => setWrongPhraseTokenId((current) => (current === tokenId ? "" : current)), 450);
  };

  const clearPhraseDrag = (): void => {
    activePointerIdRef.current = null;
    draggingPhraseTokenIdRef.current = "";
    pointerDragOffsetRef.current = { x: 0, y: 0 };
    draggingPhraseTokenSizeRef.current = { width: 0, height: 0 };
    setDraggingPhraseTokenId("");
    setDraggingPhraseTokenPosition(null);
    activeLatchSlotIndexRef.current = null;
    setActiveLatchSlotIndex(null);
  };

  const handlePhraseBuilderDrop = (tokenId: string, slotIndex: number, placedCount = placedPhraseTokenCountRef.current): boolean => {
    if (isSubmittingRef.current || phraseBuilderCompleteRef.current) {
      return false;
    }
    const token = phraseBuilderTokens.find((candidate) => candidate.id === tokenId);
    if (!token) {
      return false;
    }
    if (placedPhraseTokens.some((placedToken) => placedToken.id === token.id)) {
      return false;
    }
    if (slotIndex !== placedCount) {
      markWrongPhraseToken(token.id);
      return true;
    }
    const expectedToken = expectedPhraseTokens[placedCount];
    if (!expectedToken || token.text !== expectedToken.text) {
      markWrongPhraseToken(token.id);
      return true;
    }
    const nextPlacedTokens = [...placedPhraseTokens, token];
    const completedPhrase = nextPlacedTokens.length === expectedPhraseTokens.length;
    setPlacedPhraseTokens(nextPlacedTokens);
    setWrongPhraseTokenId("");
    schedulePlacedPhraseTokenAudio(token.text, completedPhrase);
    if (completedPhrase) {
      setPhraseBuilderComplete(true);
      if (!phraseBuilderCompletionAudioPlayedRef.current) {
        phraseBuilderCompletionAudioPlayedRef.current = true;
      }
    }
    return true;
  };

  const updateActiveLatchSlotIndex = (nextSlotIndex: number | null): void => {
    if (activeLatchSlotIndexRef.current === nextSlotIndex) {
      return;
    }
    activeLatchSlotIndexRef.current = nextSlotIndex;
    setActiveLatchSlotIndex(nextSlotIndex);
  };

  const getPhraseBuilderDragState = (draggedRect: DragRect): { position: DragPosition; shouldLatch: boolean; slotIndex: number | null } => {
    const basePosition = { left: draggedRect.left, top: draggedRect.top };
    if (!draggingPhraseTokenIdRef.current || isSubmittingRef.current || phraseBuilderCompleteRef.current) {
      updateActiveLatchSlotIndex(null);
      return { position: basePosition, shouldLatch: false, slotIndex: null };
    }
    const placedCount = placedPhraseTokenCountRef.current;
    const nextSlot = phraseSlotsRef.current?.querySelector(`[data-slot-index="${placedCount}"]`);
    if (!(nextSlot instanceof HTMLElement)) {
      updateActiveLatchSlotIndex(null);
      return { position: basePosition, shouldLatch: false, slotIndex: null };
    }
    const rect = nextSlot.getBoundingClientRect();
    const draggedCenterX = draggedRect.left + (draggedRect.width / 2);
    const draggedCenterY = draggedRect.top + (draggedRect.height / 2);
    const slotCenterX = rect.left + (rect.width / 2);
    const slotCenterY = rect.top + (rect.height / 2);
    const deltaX = slotCenterX - draggedCenterX;
    const deltaY = slotCenterY - draggedCenterY;
    const distance = Math.hypot(deltaX, deltaY);
    const captureRadius = Math.max(draggedRect.width, draggedRect.height, rect.width, rect.height) * 1.9;
    if (distance > captureRadius) {
      updateActiveLatchSlotIndex(null);
      return { position: basePosition, shouldLatch: false, slotIndex: null };
    }

    updateActiveLatchSlotIndex(placedCount);
    const attractionProgress = 1 - (distance / captureRadius);
    const attractionStrength = smoothstep(attractionProgress) * 0.68;
    const targetLeft = rect.left + ((rect.width - draggedRect.width) / 2);
    const targetTop = rect.top + ((rect.height - draggedRect.height) / 2);
    const adjustedPosition = {
      left: basePosition.left + ((targetLeft - basePosition.left) * attractionStrength),
      top: basePosition.top + ((targetTop - basePosition.top) * attractionStrength),
    };
    const slotMiddleBandWidth = rect.width * 0.36;
    const slotMiddleBandHeight = rect.height * 0.36;
    const slotMiddleLeft = slotCenterX - (slotMiddleBandWidth / 2);
    const slotMiddleRight = slotCenterX + (slotMiddleBandWidth / 2);
    const slotMiddleTop = slotCenterY - (slotMiddleBandHeight / 2);
    const slotMiddleBottom = slotCenterY + (slotMiddleBandHeight / 2);
    const coversMiddleHorizontally = draggedRect.right >= slotMiddleLeft && draggedRect.left <= slotMiddleRight;
    const coversMiddleVertically = draggedRect.bottom >= slotMiddleTop && draggedRect.top <= slotMiddleBottom;
    const latchRadius = Math.max(20, Math.min(draggedRect.width, draggedRect.height, rect.width, rect.height) * 0.22);
    return {
      position: adjustedPosition,
      shouldLatch: (coversMiddleHorizontally && coversMiddleVertically) || distance <= latchRadius,
      slotIndex: placedCount,
    };
  };

  const startPointerPhraseDrag = (tokenId: string, pointerId: number, clientX: number, clientY: number, rect: DOMRect): void => {
    if (isSubmittingRef.current || phraseBuilderCompleteRef.current) {
      return;
    }
    activePointerIdRef.current = pointerId;
    draggingPhraseTokenIdRef.current = tokenId;
    pointerDragOffsetRef.current = { x: clientX - rect.left, y: clientY - rect.top };
    draggingPhraseTokenSizeRef.current = { width: rect.width, height: rect.height };
    setDraggingPhraseTokenId(tokenId);
    setDraggingPhraseTokenPosition({ left: rect.left, top: rect.top });
  };

  const movePointerPhraseDrag = (pointerId: number, clientX: number, clientY: number): void => {
    if (activePointerIdRef.current !== pointerId) {
      return;
    }
    const nextPosition: DragPosition = {
      left: clientX - pointerDragOffsetRef.current.x,
      top: clientY - pointerDragOffsetRef.current.y,
    };
    const draggedRect: DragRect = {
      ...nextPosition,
      right: nextPosition.left + draggingPhraseTokenSizeRef.current.width,
      bottom: nextPosition.top + draggingPhraseTokenSizeRef.current.height,
      width: draggingPhraseTokenSizeRef.current.width,
      height: draggingPhraseTokenSizeRef.current.height,
    };
    const { position, shouldLatch, slotIndex } = getPhraseBuilderDragState(draggedRect);
    setDraggingPhraseTokenPosition(position);
    if (shouldLatch && slotIndex !== null && handlePhraseBuilderDrop(draggingPhraseTokenIdRef.current, slotIndex, slotIndex)) {
      clearPhraseDrag();
    }
  };

  const endPointerPhraseDrag = (pointerId: number): void => {
    if (activePointerIdRef.current !== pointerId) {
      return;
    }
    clearPhraseDrag();
  };

  useEffect(() => {
    placedPhraseTokenCountRef.current = placedPhraseTokens.length;
  }, [placedPhraseTokens.length]);

  useEffect(() => {
    phraseBuilderCompleteRef.current = phraseBuilderComplete;
  }, [phraseBuilderComplete]);

  useEffect(() => {
    isSubmittingRef.current = isSubmitting;
  }, [isSubmitting]);

  useEffect(() => {
    setShowPromptText(targetPromptMode === "text");
  }, [targetPromptMode]);

  useEffect(() => {
    setFeedback("");
    setAnswerRevealed(false);
    setPlacedPhraseTokens([]);
    setWrongPhraseTokenId("");
    setPhraseBuilderComplete(false);
    setDraggingPhraseTokenId("");
    setDraggingPhraseTokenPosition(null);
    activeLatchSlotIndexRef.current = null;
    setActiveLatchSlotIndex(null);
    setSelectedSituationChoiceIndex(null);
    setWrongSituationChoiceIndexes([]);
    draggingPhraseTokenIdRef.current = "";
    activePointerIdRef.current = null;
    pointerDragOffsetRef.current = { x: 0, y: 0 };
    draggingPhraseTokenSizeRef.current = { width: 0, height: 0 };
    phraseBuilderCompletionAudioPlayedRef.current = false;
    placedTokenVoiceRef.current = "";
    if (pendingPlacedTokenAudioTimeoutRef.current !== null) {
      window.clearTimeout(pendingPlacedTokenAudioTimeoutRef.current);
      pendingPlacedTokenAudioTimeoutRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, [item.id, item.direction]);

  useEffect(() => {
    if (targetPromptMode !== "audio") {
      return;
    }
    if (!allowPromptAudio) {
      return;
    }
    if (shouldSuppressPromptAudio) {
      return;
    }
    const autoplayKey = `phrase:${item.id}:${item.audio_url || ""}:${targetPromptMode}`;
    if (!shouldAutoplayPrompt(autoplayKey)) {
      return;
    }
    playPromptAudio();
  }, [targetPromptMode, item.id, item.audio_url, allowPromptAudio, shouldSuppressPromptAudio]);

  if (usePhraseBuilder) {
    const placedIds = new Set(placedPhraseTokens.map((token) => token.id));
    return (
      <div className="phrase-builder-review">
        <p className="prompt prompt-light test-instruction">{t("phrase.builderPrompt", { language: languageLabel })}</p>
        <p className="test-source-phrase">{promptText}</p>
        <div className="phrase-builder-target-zone">
          <div
            ref={phraseSlotsRef}
            className="phrase-builder-slots"
            aria-label={t("phrase.builderAnswerLabel")}
          >
            {expectedPhraseTokens.map((token, index) => (
              <span
                key={token.id}
                data-slot-index={index}
                className={`phrase-builder-slot${placedPhraseTokens[index] ? " phrase-builder-slot-filled" : ""}${!placedPhraseTokens[index] && activeLatchSlotIndex === index ? " phrase-builder-slot-latching" : ""}`}
              >
                <span className="phrase-builder-slot-size">{token.text}</span>
                <span className="phrase-builder-slot-value">
                  {placedPhraseTokens[index]?.text || "\u00a0"}
                </span>
              </span>
            ))}
          </div>
        </div>
        <div className="phrase-builder-bank-scroll">
          <div className="phrase-builder-bank" aria-label={t("phrase.builderBankLabel")}>
            {phraseBuilderTokens.map((token) => {
              const isPlaced = placedIds.has(token.id);
              const isDragging = draggingPhraseTokenId === token.id;
              return (
                <span
                  key={token.id}
                  className="phrase-builder-token-shell"
                  aria-hidden={isPlaced ? true : undefined}
                >
                  <span className="phrase-builder-token-placeholder" aria-hidden="true">
                    <span className="phrase-builder-token-text">{token.text}</span>
                    <span className="phrase-builder-token-handle" aria-hidden="true" />
                  </span>
                  <button
                    type="button"
                    className={`phrase-builder-token${isPlaced ? " phrase-builder-token-placed" : ""}${wrongPhraseTokenId === token.id ? " phrase-builder-token-wrong" : ""}${isDragging ? " phrase-builder-token-dragging" : ""}`}
                    style={isDragging && draggingPhraseTokenPosition
                      ? {
                        left: draggingPhraseTokenPosition.left,
                        top: draggingPhraseTokenPosition.top,
                      }
                      : undefined}
                    onPointerDown={(event) => {
                      if (isPlaced || isSubmitting || phraseBuilderComplete) {
                        return;
                      }
                      event.preventDefault();
                      event.currentTarget.setPointerCapture(event.pointerId);
                      startPointerPhraseDrag(token.id, event.pointerId, event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());
                    }}
                    onPointerMove={(event) => {
                      if (activePointerIdRef.current !== event.pointerId) {
                        return;
                      }
                      event.preventDefault();
                      movePointerPhraseDrag(event.pointerId, event.clientX, event.clientY);
                    }}
                    onPointerUp={(event) => {
                      event.preventDefault();
                      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                        event.currentTarget.releasePointerCapture(event.pointerId);
                      }
                      endPointerPhraseDrag(event.pointerId);
                    }}
                    onPointerCancel={(event) => {
                      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                        event.currentTarget.releasePointerCapture(event.pointerId);
                      }
                      endPointerPhraseDrag(event.pointerId);
                    }}
                    disabled={isPlaced || isSubmitting || phraseBuilderComplete}
                    tabIndex={isPlaced ? -1 : undefined}
                  >
                    <span className="phrase-builder-token-text">{token.text}</span>
                    <span className="phrase-builder-token-handle" aria-hidden="true" />
                  </button>
                </span>
              );
            })}
          </div>
        </div>
        {phraseBuilderComplete && <p className="phrase-builder-success">{t("phrase.builderComplete")}</p>}
        <div className="actions">
          {onOpenItem ? (
            <button type="button" className="secondary-button" onClick={() => onOpenItem(item.id)}>
              {t("words.openItem")}
            </button>
          ) : null}
          {phraseBuilderComplete && (
            <button type="button" onClick={() => void onAnswered(true)} disabled={isSubmitting}>
              {t("review.continue")}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (useSituationReview) {
    const selectedSituationIsCorrect = selectedSituationChoiceIndex !== null && selectedSituationChoiceIndex === situationOddIndex;
    return (
      <div className="phrase-situation-review">
        <p className="prompt prompt-light test-instruction">{t("phrase.situationPrompt")}</p>
        {!situationExpectedAnswer && <p className="hint">{t("phrase.situationUnavailable")}</p>}
        <div className="phrase-situation-options conversation-preview-list">
          {situationTurns.map((turn, choiceIndex) => {
            const isSelected = selectedSituationChoiceIndex === choiceIndex;
            const isCorrectChoice = situationOddIndex === choiceIndex;
            const wasWrongPick = wrongSituationChoiceIndexes.includes(choiceIndex);
            let answeredClass = "";
            if (selectedSituationChoiceIndex !== null) {
              answeredClass = isCorrectChoice
                ? " phrase-situation-option-correct"
                : isSelected
                  ? " phrase-situation-option-wrong"
                  : "";
            } else if (wasWrongPick) {
              answeredClass = " phrase-situation-option-wrong";
            }
            const revealedSourceText = selectedSituationIsCorrect && isCorrectChoice
              ? expectedAnswer
              : "";
            const speaker = speakerForTurn(turn.speaker, choiceIndex);
            return (
              <div
                key={`${choiceIndex}-${turn.target_text}`}
                className={`phrase-situation-option conversation-turn ${speaker === "a" ? "speaker-a" : "speaker-b"}${answeredClass}`}
              >
                <div className="phrase-situation-option-main">
                  <p className="conversation-speaker">
                    {speaker === "a" ? t("content.preview.personA") : t("content.preview.personB")}
                  </p>
                  <div className="phrase-situation-line conversation-line conversation-line-translation phrase-review-token-line">
                    <DialogTurnText
                      dialogId={0}
                      turnIndex={choiceIndex}
                      sourceText={turn.source_text}
                      targetText={turn.target_text}
                      sourceLanguage={sourceLanguage}
                      targetLanguage={targetLanguage}
                      tokenStatus={targetWordStatus}
                      statusKeyPrefix={`phrase-situation-${item.id}-${choiceIndex}`}
                      onTokenClick={onTargetWordClick}
                      onOpenItem={onOpenItem ? async (itemId) => onOpenItem(itemId) : undefined}
                      showPhraseSelection={false}
                    />
                  </div>
                  {revealedSourceText && (
                    <p className="phrase-situation-source-reveal">
                      {revealedSourceText}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className="phrase-situation-pick"
                  onClick={() => selectSituationChoice(choiceIndex)}
                  disabled={selectedSituationChoiceIndex !== null || isSubmitting}
                >
                  {t("phrase.situationPick")}
                </button>
              </div>
            );
          })}
        </div>
        {(selectedSituationChoiceIndex !== null || wrongSituationChoiceIndexes.length > 0) && (
          <>
            <p className={`phrase-situation-feedback ${selectedSituationIsCorrect ? "phrase-situation-feedback-correct" : "phrase-situation-feedback-wrong"}`}>
              {selectedSituationIsCorrect ? t("phrase.situationCorrect") : t("phrase.situationWrong")}
            </p>
          </>
        )}
        <div className="actions">
          {onOpenItem ? (
            <button type="button" className="secondary-button" onClick={() => onOpenItem(item.id)}>
              {t("words.openItem")}
            </button>
          ) : null}
          {selectedSituationChoiceIndex !== null && (
            <button type="button" onClick={() => void onAnswered(true)} disabled={isSubmitting}>
              {t("review.continue")}
            </button>
          )}
          {!situationExpectedAnswer && (
            <button type="button" onClick={() => void continueWithCompletionAudio()} disabled={isSubmitting}>
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
      {feedback && <p>{feedback}</p>}
    </div>
  );
}
