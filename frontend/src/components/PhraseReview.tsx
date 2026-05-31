import { Fragment, useEffect, useMemo, useRef, useState } from "react";

import { shouldAutoplayPrompt } from "../audioAutoplayGuard";
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

function hashToken(value: string): number {
  return value.split("").reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0);
}

function shufflePhraseTokens(tokens: PhraseToken[], seed: number): PhraseToken[] {
  if (tokens.length < 2) {
    return tokens;
  }
  const shuffled = [...tokens].sort((left, right) => {
    const leftHash = hashToken(`${seed}:${left.id}:${left.text}`);
    const rightHash = hashToken(`${seed}:${right.id}:${right.text}`);
    return leftHash - rightHash;
  });
  const keptOriginalOrder = shuffled.every((token, index) => token.originalIndex === index);
  return keptOriginalOrder ? [...shuffled].reverse() : shuffled;
}

function uniqueChoices(values: string[]): string[] {
  const seen = new Set<string>();
  return values
    .map((value) => value.trim())
    .filter((value) => {
      if (!value || seen.has(value.toLowerCase())) {
        return false;
      }
      seen.add(value.toLowerCase());
      return true;
    });
}

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
  const [phraseBuilderComplete, setPhraseBuilderComplete] = useState<boolean>(false);
  const [selectedSituationChoice, setSelectedSituationChoice] = useState<string>("");
  const draggingPhraseTokenIdRef = useRef<string>("");
  const phraseSlotsRef = useRef<HTMLDivElement | null>(null);
  const placedPhraseTokenCountRef = useRef<number>(0);
  const phraseBuilderCompleteRef = useRef<boolean>(false);
  const isSubmittingRef = useRef<boolean>(false);
  const phraseBuilderCompletionAudioPlayedRef = useRef<boolean>(false);
  const activePointerIdRef = useRef<number | null>(null);
  const pointerDragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isSpanishToGerman = item.direction !== "de_to_es";
  const allowPromptAudio = !isSpanishToGerman;
  const promptText = isSpanishToGerman ? item.spanish_text : item.german_text;
  const expectedAnswer = isSpanishToGerman ? item.german_text : item.spanish_text;
  const expectedPhraseTokens = useMemo(() => phraseTokens(expectedAnswer), [expectedAnswer]);
  const phraseBuilderTokens = useMemo(() => shufflePhraseTokens(expectedPhraseTokens, item.id), [expectedPhraseTokens, item.id]);
  const situationExpectedAnswer = (item.dialog_phrase_answer || "").trim();
  const situationSceneLines = (item.dialog_phrase_scene || situationExpectedAnswer)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const situationSceneAudioUrls = (item.dialog_phrase_scene_audio_urls || []).filter((audioUrl) => audioUrl.trim().length > 0);
  const situationChoices = useMemo(() => {
    const dialogChoices = uniqueChoices(item.dialog_phrase_options || []);
    const dialogChoicesIncludeAnswer = dialogChoices.some((choice) => choice.toLowerCase() === situationExpectedAnswer.toLowerCase());
    if (situationExpectedAnswer && dialogChoices.length >= 2 && dialogChoicesIncludeAnswer) {
      return dialogChoices.slice(0, 4);
    }
    return situationExpectedAnswer ? uniqueChoices([situationExpectedAnswer, ...dialogChoices]).slice(0, 4) : [];
  }, [situationExpectedAnswer, item.dialog_phrase_options]);
  const languageLabel = isSpanishToGerman
    ? t(languageKeyByCode[targetLanguage])
    : t(languageKeyByCode[sourceLanguage]);
  const hidePromptText = targetPromptMode === "audio" && allowPromptAudio && !showPromptText;
  const useRepeatPlaceholder = Boolean(item.repeatedAfterFailure);
  const usePhraseBuilder = useRepeatPlaceholder && isSpanishToGerman;
  const useSituationReview = useRepeatPlaceholder && !isSpanishToGerman;

  const playPromptAudio = (): void => {
    if (!allowPromptAudio || !item.audio_url) {
      return;
    }
    const audio = new Audio(item.audio_url);
    void audio.play().catch(() => {});
  };

  const playPhraseAudio = (): void => {
    if (!item.audio_url) {
      return;
    }
    const audio = new Audio(item.audio_url);
    void audio.play().catch(() => {});
  };

  const playSituationScene = (): void => {
    if (!situationSceneAudioUrls.length) {
      return;
    }
    const playNext = (index: number): void => {
      const audioUrl = situationSceneAudioUrls[index];
      if (!audioUrl) {
        return;
      }
      const audio = new Audio(audioUrl);
      audio.onended = () => playNext(index + 1);
      audio.onerror = () => playNext(index + 1);
      void audio.play().catch(() => playNext(index + 1));
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
      await new Promise((resolve) => setTimeout(resolve, FEEDBACK_DELAY_MS));
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

  const selectSituationChoice = (choice: string): void => {
    if (selectedSituationChoice || isSubmitting) {
      return;
    }
    setSelectedSituationChoice(choice);
  };

  const markWrongPhraseToken = (tokenId: string): void => {
    setWrongPhraseTokenId(tokenId);
    window.setTimeout(() => setWrongPhraseTokenId((current) => (current === tokenId ? "" : current)), 450);
  };

  const clearPhraseDrag = (): void => {
    activePointerIdRef.current = null;
    draggingPhraseTokenIdRef.current = "";
    pointerDragOffsetRef.current = { x: 0, y: 0 };
    setDraggingPhraseTokenId("");
    setDraggingPhraseTokenPosition(null);
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
    setPlacedPhraseTokens(nextPlacedTokens);
    setWrongPhraseTokenId("");
    if (nextPlacedTokens.length === expectedPhraseTokens.length) {
      setPhraseBuilderComplete(true);
      if (!phraseBuilderCompletionAudioPlayedRef.current) {
        phraseBuilderCompletionAudioPlayedRef.current = true;
        playPhraseAudio();
      }
    }
    return true;
  };

  const handlePhraseBuilderSlotProximity = (clientX: number, clientY: number): void => {
    if (!draggingPhraseTokenIdRef.current || isSubmittingRef.current || phraseBuilderCompleteRef.current) {
      return;
    }
    const placedCount = placedPhraseTokenCountRef.current;
    const nextSlot = phraseSlotsRef.current?.querySelector(`[data-slot-index="${placedCount}"]`);
    if (!(nextSlot instanceof HTMLElement)) {
      return;
    }
    const rect = nextSlot.getBoundingClientRect();
    const tolerance = 44;
    const isCloseToNextSlot = clientX >= rect.left - tolerance
      && clientX <= rect.right + tolerance
      && clientY >= rect.top - tolerance
      && clientY <= rect.bottom + tolerance;
    if (!isCloseToNextSlot) {
      return;
    }
    if (handlePhraseBuilderDrop(draggingPhraseTokenIdRef.current, placedCount, placedCount)) {
      clearPhraseDrag();
    }
  };

  const startPointerPhraseDrag = (tokenId: string, pointerId: number, clientX: number, clientY: number, rect: DOMRect): void => {
    if (isSubmittingRef.current || phraseBuilderCompleteRef.current) {
      return;
    }
    activePointerIdRef.current = pointerId;
    draggingPhraseTokenIdRef.current = tokenId;
    pointerDragOffsetRef.current = { x: clientX - rect.left, y: clientY - rect.top };
    setDraggingPhraseTokenId(tokenId);
    setDraggingPhraseTokenPosition({ left: rect.left, top: rect.top });
  };

  const movePointerPhraseDrag = (pointerId: number, clientX: number, clientY: number): void => {
    if (activePointerIdRef.current !== pointerId) {
      return;
    }
    setDraggingPhraseTokenPosition({
      left: clientX - pointerDragOffsetRef.current.x,
      top: clientY - pointerDragOffsetRef.current.y,
    });
    handlePhraseBuilderSlotProximity(clientX, clientY);
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
    setSelectedSituationChoice("");
    draggingPhraseTokenIdRef.current = "";
    activePointerIdRef.current = null;
    pointerDragOffsetRef.current = { x: 0, y: 0 };
    phraseBuilderCompletionAudioPlayedRef.current = false;
  }, [item.id, item.direction]);

  useEffect(() => {
    if (targetPromptMode !== "audio") {
      return;
    }
    if (!allowPromptAudio) {
      return;
    }
    const autoplayKey = `phrase:${item.id}:${item.audio_url || ""}:${targetPromptMode}`;
    if (!shouldAutoplayPrompt(autoplayKey)) {
      return;
    }
    playPromptAudio();
  }, [targetPromptMode, item.id, item.audio_url, allowPromptAudio]);

  if (usePhraseBuilder) {
    const placedIds = new Set(placedPhraseTokens.map((token) => token.id));
    const remainingTokens = phraseBuilderTokens.filter((token) => !placedIds.has(token.id));
    return (
      <div>
        <p className="prompt">{t("phrase.builderPrompt", { language: languageLabel })}</p>
        <p className="test-source-phrase">{promptText}</p>
        <div
          ref={phraseSlotsRef}
          className="phrase-builder-slots"
          aria-label={t("phrase.builderAnswerLabel")}
        >
          {expectedPhraseTokens.map((token, index) => (
            <span
              key={token.id}
              data-slot-index={index}
              className={`phrase-builder-slot${placedPhraseTokens[index] ? " phrase-builder-slot-filled" : ""}`}
            >
              {placedPhraseTokens[index]?.text || "\u00a0"}
            </span>
          ))}
        </div>
        <div className="phrase-builder-bank" aria-label={t("phrase.builderBankLabel")}>
          {remainingTokens.map((token) => (
            <button
              key={token.id}
              type="button"
              className={`phrase-builder-token${wrongPhraseTokenId === token.id ? " phrase-builder-token-wrong" : ""}${draggingPhraseTokenId === token.id ? " phrase-builder-token-dragging" : ""}`}
              style={draggingPhraseTokenId === token.id && draggingPhraseTokenPosition
                ? {
                  left: draggingPhraseTokenPosition.left,
                  top: draggingPhraseTokenPosition.top,
                }
                : undefined}
              onPointerDown={(event) => {
                if (isSubmitting || phraseBuilderComplete) {
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
              disabled={isSubmitting || phraseBuilderComplete}
            >
              <span className="phrase-builder-token-text">{token.text}</span>
              <span className="phrase-builder-token-handle" aria-hidden="true" />
            </button>
          ))}
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
    const selectedSituationIsCorrect = selectedSituationChoice.trim().toLowerCase() === situationExpectedAnswer.toLowerCase();
    return (
      <div>
        <p className="prompt prompt-light">{t("phrase.situationPrompt")}</p>
        <p className="test-source-phrase phrase-review-token-line">
          <DialogTurnText
            dialogId={0}
            turnIndex={0}
            sourceText={item.spanish_text}
            targetText={item.german_text}
            sourceLanguage={sourceLanguage}
            targetLanguage={targetLanguage}
            tokenStatus={targetWordStatus}
            statusKeyPrefix={`phrase-review-${item.id}-target`}
            onTokenClick={onTargetWordClick}
            onOpenItem={onOpenItem ? async (itemId) => onOpenItem(itemId) : undefined}
            showPhraseSelection={false}
          />
        </p>
        {!situationExpectedAnswer && <p className="hint">{t("phrase.situationUnavailable")}</p>}
        <div className="phrase-situation-options">
          {situationChoices.map((choice) => {
            const isSelected = selectedSituationChoice === choice;
            const isCorrectChoice = choice.trim().toLowerCase() === situationExpectedAnswer.toLowerCase();
            const answeredClass = selectedSituationChoice
              ? isCorrectChoice
                ? " phrase-situation-option-correct"
                : isSelected
                  ? " phrase-situation-option-wrong"
                  : ""
              : "";
            return (
              <button
                key={choice}
                type="button"
                className={`phrase-situation-option${answeredClass}`}
                onClick={() => selectSituationChoice(choice)}
                disabled={Boolean(selectedSituationChoice) || isSubmitting}
              >
                {t("phrase.situationChoice", { text: choice })}
              </button>
            );
          })}
        </div>
        {selectedSituationChoice && (
          <>
            <p className={`phrase-situation-feedback ${selectedSituationIsCorrect ? "phrase-situation-feedback-correct" : "phrase-situation-feedback-wrong"}`}>
              {selectedSituationIsCorrect ? t("phrase.situationCorrect") : t("phrase.situationWrong")}
            </p>
            <p className="revealed-answer">
              <span>{t("phrase.situationSceneLabel")}</span>
              {situationSceneLines.map((line, index) => (
                <Fragment key={`${line}-${index}`}>
                  <br />
                  {line}
                </Fragment>
              ))}
            </p>
            {!!situationSceneAudioUrls.length && (
              <button type="button" className="secondary-button phrase-scene-play-button" onClick={playSituationScene}>
                {t("phrase.situationPlayScene")}
              </button>
            )}
          </>
        )}
        <div className="actions">
          {onOpenItem ? (
            <button type="button" className="secondary-button" onClick={() => onOpenItem(item.id)}>
              {t("words.openItem")}
            </button>
          ) : null}
          {selectedSituationChoice && (
            <button type="button" onClick={() => void onAnswered(true)} disabled={isSubmitting}>
              {t("review.continue")}
            </button>
          )}
          {!situationExpectedAnswer && (
            <button type="button" onClick={() => void onAnswered(true)} disabled={isSubmitting}>
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
