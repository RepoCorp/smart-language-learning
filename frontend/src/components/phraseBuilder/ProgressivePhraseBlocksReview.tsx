import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { deterministicSort } from "../../deterministic";
import { useI18n } from "../../i18n";
import DialogActionIcon from "../DialogActionIcon";
import {
  grammarDistractorsForBlock,
  sameGrammarForm,
} from "./grammarDistractors";

interface ProgressivePhraseBlocksReviewProps {
  promptText: string;
  expectedAnswer: string;
  languageLabel: string;
  targetLanguage: string;
  phraseKey: string;
  distractorTexts: string[];
  isSubmitting: boolean;
  reviewComplete: boolean;
  hasAudio: boolean;
  onComplete: () => Promise<void>;
  onReplayAudio: () => Promise<boolean>;
  onNextItem?: () => Promise<void>;
  postReviewActions?: ReactNode;
}

type PhraseToken = {
  id: string;
  text: string;
};

const FALLBACK_DISTRACTOR_WORDS: Record<string, string[]> = {
  spanish: ["ahora", "casa", "mesa", "pero", "mañana", "pequeño"],
  english: ["today", "house", "table", "because", "small", "again"],
  german: ["heute", "Haus", "Tisch", "aber", "klein", "morgen"],
  french: ["aujourd'hui", "maison", "table", "mais", "petit", "demain"],
  italian: ["oggi", "casa", "tavolo", "ma", "piccolo", "domani"],
  portuguese: ["hoje", "casa", "mesa", "mas", "pequeno", "amanhã"],
  dutch: ["vandaag", "huis", "tafel", "maar", "klein", "morgen"],
};

function phraseTokens(value: string): PhraseToken[] {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((text, index) => ({ id: `${index}-${text}`, text }));
}

function choiceWord(value: string): string {
  return value.trim().replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
}

function initialLetter(value: string): string {
  return choiceWord(value).toLocaleLowerCase().slice(0, 1);
}

function choicesForNextToken(
  tokens: PhraseToken[],
  placedCount: number,
  phraseKey: string,
  distractorTexts: string[],
  targetLanguage: string,
): PhraseToken[] {
  const correct = tokens[placedCount];
  if (!correct) {
    return [];
  }
  const isPhraseWord = (word: string): boolean => tokens.some((token) => sameGrammarForm(token.text, word));
  const remainingInitials = new Set(tokens.slice(placedCount + 1).map((token) => initialLetter(token.text)).filter(Boolean));
  const otherPhraseInitials = new Set(
    tokens.filter((token) => token.id !== correct.id).map((token) => initialLetter(token.text)).filter(Boolean),
  );
  const grammarDistractors = grammarDistractorsForBlock(correct.text, targetLanguage)
    .filter((word) => !isPhraseWord(word));
  const availableWords = [...distractorTexts.flatMap((text) => text.split(/\s+/)), ...(FALLBACK_DISTRACTOR_WORDS[targetLanguage] || [])]
    .map(choiceWord)
    .filter((word) => word && !isPhraseWord(word));
  const grammarChoices = deterministicSort(grammarDistractors, `${phraseKey}:${placedCount}:grammar`, (word) => word)
    .filter((word, index, words) => words.findIndex((value) => sameGrammarForm(value, word)) === index)
    .slice(0, 2);
  const matchingInitialWords = availableWords.filter((word) => remainingInitials.has(initialLetter(word)));
  // The last word has no remaining initial to borrow, so use another phrase initial to retain a useful choice set.
  const fallbackInitialWords = availableWords.filter((word) => otherPhraseInitials.has(initialLetter(word)));
  const randomPool = [
    ...matchingInitialWords,
    ...fallbackInitialWords.filter(
      (word) => !matchingInitialWords.some((matchingWord) => sameGrammarForm(matchingWord, word)),
    ),
  ];
  const randomChoices = deterministicSort(randomPool, `${phraseKey}:${placedCount}:random`, (word) => word)
    .filter((word, index, words) =>
      !grammarChoices.some((grammarChoice) => sameGrammarForm(grammarChoice, word))
        && words.findIndex((value) => sameGrammarForm(value, word)) === index,
    )
    .slice(0, 2 - grammarChoices.length);
  const distractors = [...grammarChoices, ...randomChoices];
  const candidates = [correct, ...distractors.map((text, index) => ({ id: `distractor-${index}-${text}`, text }))]
    .filter((token, index, values) => values.findIndex((value) => sameGrammarForm(value.text, token.text)) === index);
  return deterministicSort(candidates, `phrase-builder-choices:${phraseKey}:${placedCount}`, (token) => token.id);
}

export default function ProgressivePhraseBlocksReview({
  promptText,
  expectedAnswer,
  languageLabel,
  targetLanguage,
  phraseKey,
  distractorTexts,
  isSubmitting,
  reviewComplete,
  hasAudio,
  onComplete,
  onReplayAudio,
  onNextItem,
  postReviewActions,
}: ProgressivePhraseBlocksReviewProps): JSX.Element {
  const { t } = useI18n();
  const tokens = useMemo(() => phraseTokens(expectedAnswer), [expectedAnswer]);
  const [placedCount, setPlacedCount] = useState(0);
  const [wrongTokenId, setWrongTokenId] = useState("");
  const [isCompleting, setIsCompleting] = useState(false);
  const [revealedLetterCount, setRevealedLetterCount] = useState(0);
  const [revealedTokenId, setRevealedTokenId] = useState("");
  const [draggingTokenId, setDraggingTokenId] = useState("");
  const [draggingPosition, setDraggingPosition] = useState<{ left: number; top: number } | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const draggingTokenRef = useRef<PhraseToken | null>(null);
  const draggingElementRef = useRef<HTMLButtonElement | null>(null);
  const pointerOffsetRef = useRef({ x: 0, y: 0 });
  const activeSlotRef = useRef<HTMLSpanElement | null>(null);
  const showNextLetterButtonRef = useRef<HTMLButtonElement | null>(null);
  const shouldKeepRevealControlVisibleRef = useRef(false);
  const complete = placedCount === tokens.length && tokens.length > 0;
  const isDraggingExpectedToken = draggingTokenId === tokens[placedCount]?.id;
  const choices = useMemo(
    () => choicesForNextToken(tokens, placedCount, phraseKey, distractorTexts, targetLanguage),
    [tokens, placedCount, phraseKey, distractorTexts, targetLanguage],
  );

  useEffect(() => {
    setPlacedCount(0);
    setWrongTokenId("");
    setIsCompleting(false);
    setRevealedTokenId("");
    setDraggingTokenId("");
    setDraggingPosition(null);
    activePointerIdRef.current = null;
    draggingTokenRef.current = null;
    draggingElementRef.current = null;
    shouldKeepRevealControlVisibleRef.current = false;
  }, [phraseKey]);

  useEffect(() => {
    if (!shouldKeepRevealControlVisibleRef.current || complete) {
      return;
    }
    shouldKeepRevealControlVisibleRef.current = false;
    const animationFrame = window.requestAnimationFrame(() => {
      showNextLetterButtonRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, [complete, placedCount]);

  const chooseToken = async (token: PhraseToken): Promise<void> => {
    if (isSubmitting || isCompleting || complete) {
      return;
    }
    const expectedToken = tokens[placedCount];
    if (!expectedToken || token.id !== expectedToken.id) {
      setWrongTokenId(token.id);
      window.setTimeout(() => setWrongTokenId((current) => (current === token.id ? "" : current)), 450);
      return;
    }
    const nextPlacedCount = placedCount + 1;
    setPlacedCount(nextPlacedCount);
    setRevealedLetterCount(0);
    setRevealedTokenId("");
    setWrongTokenId("");
    if (nextPlacedCount !== tokens.length) {
      shouldKeepRevealControlVisibleRef.current = true;
      return;
    }
    setIsCompleting(true);
    try {
      await onComplete();
    } finally {
      setIsCompleting(false);
    }
  };

  const clearDrag = (): void => {
    activePointerIdRef.current = null;
    draggingTokenRef.current = null;
    draggingElementRef.current = null;
    setDraggingTokenId("");
    setDraggingPosition(null);
  };

  const isOverActiveSlot = (clientX: number, clientY: number): boolean => {
    const slot = activeSlotRef.current;
    if (!slot) {
      return false;
    }
    const rect = slot.getBoundingClientRect();
    const touchTargetPadding = window.matchMedia("(pointer: coarse)").matches ? 32 : 0;
    return (
      clientX >= rect.left - touchTargetPadding
      && clientX <= rect.right + touchTargetPadding
      && clientY >= rect.top - touchTargetPadding
      && clientY <= rect.bottom + touchTargetPadding
    );
  };

  const revealNextLetter = (): void => {
    const longestChoiceLength = Math.max(...choices.map((token) => token.text.length));
    let nextCount = Math.min(revealedLetterCount + 1, longestChoiceLength);
    // Reveal a shared prefix together; stop before the first useful distinction.
    while (
      nextCount < longestChoiceLength
      && choices.every((token) => token.text[nextCount] === choices[0].text[nextCount])
    ) {
      nextCount += 1;
    }
    setRevealedLetterCount(nextCount);
  };

  const settleDrag = (token: PhraseToken, pointerId: number, clientX: number, clientY: number): void => {
    if (activePointerIdRef.current !== pointerId) {
      return;
    }
    const element = draggingElementRef.current;
    if (element?.hasPointerCapture(pointerId)) {
      element.releasePointerCapture(pointerId);
    }
    const wasDroppedOnTarget = isOverActiveSlot(clientX, clientY);
    clearDrag();
    if (wasDroppedOnTarget) {
      void chooseToken(token);
    }
  };

  useEffect(() => {
    const handlePointerUp = (event: PointerEvent): void => {
      const token = draggingTokenRef.current;
      if (token) {
        settleDrag(token, event.pointerId, event.clientX, event.clientY);
      }
    };
    const handlePointerCancel = (event: PointerEvent): void => {
      if (activePointerIdRef.current === event.pointerId) {
        clearDrag();
      }
    };
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);
    return () => {
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
    };
  });

  return (
    <div className="phrase-builder-review phrase-builder-progressive-review">
      <p className="prompt prompt-light test-instruction">{t("phrase.progressiveBlocksPrompt", { language: languageLabel })}</p>
      <p className="test-source-phrase">{promptText}</p>
      <div className="phrase-builder-target-zone">
        <div className="phrase-builder-slots" aria-label={t("phrase.progressiveBlocksAnswerLabel")}>
          {tokens.slice(0, placedCount).map((token) => (
            <span
              key={token.id}
              className="phrase-builder-slot phrase-builder-slot-filled"
            >
              <span className="phrase-builder-slot-value">{token.text}</span>
            </span>
          ))}
          {!complete && (
            <span
              ref={activeSlotRef}
              className={`phrase-builder-slot${isDraggingExpectedToken ? " phrase-builder-slot-latching" : ""}`}
            >
              <span className="phrase-builder-slot-value">{"\u00a0"}</span>
            </span>
          )}
        </div>
      </div>
      {!complete && (
        <div className="phrase-builder-choice-area">
          <div className="phrase-builder-bank" aria-label={t("phrase.progressiveBlocksChoiceLabel")}>
            {choices.map((token) => (
                  <button
                    key={token.id}
                    type="button"
                    className={`phrase-builder-token${wrongTokenId === token.id ? " phrase-builder-token-wrong" : ""}${draggingTokenId === token.id ? " phrase-builder-token-dragging" : ""}`}
                    style={draggingTokenId === token.id && draggingPosition ? draggingPosition : undefined}
                    onClick={(event) => {
                      if (event.detail === 0) {
                        void chooseToken(token);
                      }
                    }}
                    onPointerDown={(event) => {
                      if (isSubmitting || isCompleting) {
                        return;
                      }
                      event.preventDefault();
                      if (token.id === tokens[placedCount]?.id) {
                        setRevealedTokenId(token.id);
                      }
                      event.currentTarget.setPointerCapture(event.pointerId);
                      const rect = event.currentTarget.getBoundingClientRect();
                      const touchLift = window.matchMedia("(pointer: coarse)").matches ? 18 : 0;
                      activePointerIdRef.current = event.pointerId;
                      draggingTokenRef.current = token;
                      draggingElementRef.current = event.currentTarget;
                      // Keep the pointer at the lower edge so it does not hide the letters while dragging.
                      pointerOffsetRef.current = { x: event.clientX - rect.left, y: rect.height - 5 + touchLift };
                      setDraggingTokenId(token.id);
                      setDraggingPosition({ left: rect.left, top: rect.top });
                    }}
                    onPointerMove={(event) => {
                      if (activePointerIdRef.current !== event.pointerId) {
                        return;
                      }
                      event.preventDefault();
                      setDraggingPosition({
                        left: event.clientX - pointerOffsetRef.current.x,
                        top: event.clientY - pointerOffsetRef.current.y,
                      });
                      if (isOverActiveSlot(event.clientX, event.clientY)) {
                        settleDrag(token, event.pointerId, event.clientX, event.clientY);
                      }
                    }}
                    onPointerUp={(event) => {
                      event.preventDefault();
                      settleDrag(token, event.pointerId, event.clientX, event.clientY);
                    }}
                    onPointerCancel={(event) => {
                      if (activePointerIdRef.current === event.pointerId) {
                        clearDrag();
                      }
                    }}
                    onLostPointerCapture={() => clearDrag()}
                    disabled={isSubmitting || isCompleting}
                    aria-label={token.text}
                  >
                    <span aria-hidden="true">{token.id === revealedTokenId ? token.text : token.text.slice(0, revealedLetterCount)}</span>
                  </button>
            ))}
          </div>
          {revealedLetterCount < Math.max(...choices.map((token) => token.text.length)) && (
            <button
              type="button"
              className="secondary-button"
              ref={showNextLetterButtonRef}
              onClick={revealNextLetter}
              disabled={isSubmitting || isCompleting}
            >
              {t("phrase.progressiveBlocksShowNextLetter")}
            </button>
          )}
        </div>
      )}
      {complete && <p className="phrase-builder-success">{t("phrase.progressiveBlocksComplete")}</p>}
      {reviewComplete && (
        <div className="actions">
          {hasAudio && (
            <button
              type="button"
              className="secondary-button exercise-action-icon-button"
              onClick={() => void onReplayAudio()}
              aria-label={t("prompt.replayAudio")}
              title={t("prompt.replayAudio")}
            >
              <DialogActionIcon name="play" />
            </button>
          )}
          <button type="button" onClick={() => void onNextItem?.()} disabled={isSubmitting || isCompleting}>
            {t("session.nextItem")}
          </button>
          {postReviewActions}
        </div>
      )}
    </div>
  );
}
