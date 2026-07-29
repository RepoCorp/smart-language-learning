import { useEffect, useMemo, useRef, useState } from "react";

import { useI18n } from "../i18n";
import type { SessionItem } from "../types";
import { buildWordPartUnits, shuffleWordPartTokens } from "./wordParts";

interface WordPartsReviewProps {
  item: SessionItem;
  onAnswered: (correct: boolean) => Promise<void>;
}

const FEEDBACK_DELAY_MS = 500;

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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function smoothstep(value: number): number {
  const clamped = clamp(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}

export default function WordPartsReview({
  item,
  onAnswered,
}: WordPartsReviewProps): JSX.Element {
  const { t } = useI18n();
  const [placedTokenIds, setPlacedTokenIds] = useState<string[]>([]);
  const [wrongTokenId, setWrongTokenId] = useState<string>("");
  const [feedback, setFeedback] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [draggingTokenId, setDraggingTokenId] = useState<string>("");
  const [draggingTokenPosition, setDraggingTokenPosition] = useState<DragPosition | null>(null);
  const [activeLatchSlotIndex, setActiveLatchSlotIndex] = useState<number | null>(null);

  const tokenSeed = `${item.id}:${item.german_text}:${item.direction || ""}:word-parts`;
  const { units, tokens } = useMemo(
    () => buildWordPartUnits(item.german_text),
    [item.german_text],
  );
  const shuffledTokens = useMemo(
    () => shuffleWordPartTokens(tokens, tokenSeed),
    [tokenSeed, tokens],
  );
  const placedTokenMap = useMemo(
    () => new Map(tokens.map((token) => [token.id, token])),
    [tokens],
  );
  const slotsRef = useRef<HTMLDivElement | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const draggingTokenIdRef = useRef<string>("");
  const pointerDragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const draggingTokenSizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const activeLatchSlotIndexRef = useRef<number | null>(null);
  const placedCount = placedTokenIds.length;

  const markWrongToken = (tokenId: string): void => {
    setWrongTokenId(tokenId);
    window.setTimeout(() => {
      setWrongTokenId((current) => (current === tokenId ? "" : current));
    }, 450);
  };

  const clearDrag = (): void => {
    draggingTokenIdRef.current = "";
    activePointerIdRef.current = null;
    setDraggingTokenId("");
    setDraggingTokenPosition(null);
    activeLatchSlotIndexRef.current = null;
    setActiveLatchSlotIndex(null);
  };

  const completeReview = async (): Promise<void> => {
    setSubmitting(true);
    setFeedback(t("word.feedback.correct"));
    try {
      await new Promise((resolve) => window.setTimeout(resolve, FEEDBACK_DELAY_MS));
      await onAnswered(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTokenClick = (tokenId: string): void => {
    if (submitting || placedTokenIds.includes(tokenId)) {
      return;
    }
    const expectedToken = tokens[placedCount];
    if (!expectedToken || expectedToken.id !== tokenId) {
      markWrongToken(tokenId);
      setFeedback(t("word.partsWrongChunk"));
      return;
    }
    const nextPlaced = [...placedTokenIds, tokenId];
    setPlacedTokenIds(nextPlaced);
    setFeedback("");
    if (nextPlaced.length === tokens.length) {
      void completeReview();
    }
  };

  const handleDrop = (tokenId: string, slotIndex: number, currentPlacedCount = placedCount): boolean => {
    if (submitting) {
      return false;
    }
    if (slotIndex !== currentPlacedCount) {
      markWrongToken(tokenId);
      setFeedback(t("word.partsWrongChunk"));
      return true;
    }
    handleTokenClick(tokenId);
    return true;
  };

  const updateActiveLatchIndex = (nextSlotIndex: number | null): void => {
    if (activeLatchSlotIndexRef.current === nextSlotIndex) {
      return;
    }
    activeLatchSlotIndexRef.current = nextSlotIndex;
    setActiveLatchSlotIndex(nextSlotIndex);
  };

  const getDragState = (draggedRect: DragRect): { position: DragPosition; shouldLatch: boolean; slotIndex: number | null } => {
    const basePosition = { left: draggedRect.left, top: draggedRect.top };
    if (!draggingTokenIdRef.current || submitting) {
      updateActiveLatchIndex(null);
      return { position: basePosition, shouldLatch: false, slotIndex: null };
    }
    const nextSlot = slotsRef.current?.querySelector(`[data-slot-index="${placedCount}"]`);
    if (!(nextSlot instanceof HTMLElement)) {
      updateActiveLatchIndex(null);
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
      updateActiveLatchIndex(null);
      return { position: basePosition, shouldLatch: false, slotIndex: null };
    }

    updateActiveLatchIndex(placedCount);
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

  const startPointerDrag = (tokenId: string, pointerId: number, clientX: number, clientY: number, rect: DOMRect): void => {
    if (submitting || placedTokenIds.includes(tokenId)) {
      return;
    }
    activePointerIdRef.current = pointerId;
    draggingTokenIdRef.current = tokenId;
    pointerDragOffsetRef.current = { x: clientX - rect.left, y: clientY - rect.top };
    draggingTokenSizeRef.current = { width: rect.width, height: rect.height };
    setDraggingTokenId(tokenId);
    setDraggingTokenPosition({ left: rect.left, top: rect.top });
  };

  const movePointerDrag = (pointerId: number, clientX: number, clientY: number): void => {
    if (activePointerIdRef.current !== pointerId) {
      return;
    }
    const nextPosition = {
      left: clientX - pointerDragOffsetRef.current.x,
      top: clientY - pointerDragOffsetRef.current.y,
    };
    const draggedRect: DragRect = {
      ...nextPosition,
      right: nextPosition.left + draggingTokenSizeRef.current.width,
      bottom: nextPosition.top + draggingTokenSizeRef.current.height,
      width: draggingTokenSizeRef.current.width,
      height: draggingTokenSizeRef.current.height,
    };
    const { position, shouldLatch, slotIndex } = getDragState(draggedRect);
    setDraggingTokenPosition(position);
    if (shouldLatch && slotIndex !== null && handleDrop(draggingTokenIdRef.current, slotIndex, slotIndex)) {
      clearDrag();
    }
  };

  const endPointerDrag = (pointerId: number): void => {
    if (activePointerIdRef.current !== pointerId) {
      return;
    }
    clearDrag();
  };

  const resetPlacedTokens = (): void => {
    if (submitting) {
      return;
    }
    setPlacedTokenIds([]);
    setWrongTokenId("");
    setFeedback("");
  };

  useEffect(() => {
    clearDrag();
  }, [item.id]);

  return (
    <div className="phrase-builder-review word-parts-review">
      <p className="prompt prompt-light test-instruction">{t("word.partsPromptInstruction")}</p>
      <p className="test-source-phrase">{item.spanish_text}</p>
      <div className="phrase-builder-target-zone word-parts-target-zone">
        <div
          ref={slotsRef}
          className="phrase-builder-slots word-parts-slots"
          aria-label={t("word.partsSlotsLabel")}
        >
          {units.map((unit, index) => {
            if (unit.type === "separator") {
              return (
                <span key={`separator-${index}`} className="word-parts-separator">
                  {unit.text}
                </span>
              );
            }
            const tokenIndex = unit.token.originalIndex;
            const placedTokenId = placedTokenIds[tokenIndex];
            const placedToken = placedTokenId ? placedTokenMap.get(placedTokenId) : null;
            return (
              <div
                key={unit.token.id}
                data-slot-index={tokenIndex}
                className={`phrase-builder-slot word-parts-slot${placedToken ? " phrase-builder-slot-filled" : ""}${!placedToken && activeLatchSlotIndex === tokenIndex ? " phrase-builder-slot-latching" : ""}`}
              >
                <span className="phrase-builder-slot-size" aria-hidden="true">
                  {unit.token.text}
                </span>
                <span className="phrase-builder-slot-value">
                  {placedToken?.text || ""}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="phrase-builder-bank-scroll">
        <div className="phrase-builder-bank word-parts-bank" aria-label={t("word.partsBankLabel")}>
          {shuffledTokens.map((token) => {
            const isPlaced = placedTokenIds.includes(token.id);
            const isDragging = draggingTokenId === token.id;
            return (
              <span
                key={token.id}
                className="phrase-builder-token-shell"
                aria-hidden={isPlaced ? true : undefined}
              >
                <span className="phrase-builder-token-placeholder" aria-hidden="true">
                  <span className="phrase-builder-token-text">{token.text}</span>
                </span>
                <button
                  type="button"
                  className={`phrase-builder-token${isPlaced ? " phrase-builder-token-placed" : ""}${wrongTokenId === token.id ? " phrase-builder-token-wrong" : ""}${isDragging ? " phrase-builder-token-dragging" : ""}`}
                  style={isDragging && draggingTokenPosition
                    ? {
                      left: draggingTokenPosition.left,
                      top: draggingTokenPosition.top,
                    }
                    : undefined}
                  onClick={() => handleTokenClick(token.id)}
                  onPointerDown={(event) => {
                    if (isPlaced || submitting) {
                      return;
                    }
                    event.preventDefault();
                    event.currentTarget.setPointerCapture(event.pointerId);
                    startPointerDrag(token.id, event.pointerId, event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());
                  }}
                  onPointerMove={(event) => {
                    if (activePointerIdRef.current !== event.pointerId) {
                      return;
                    }
                    event.preventDefault();
                    movePointerDrag(event.pointerId, event.clientX, event.clientY);
                  }}
                  onPointerUp={(event) => {
                    event.preventDefault();
                    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                      event.currentTarget.releasePointerCapture(event.pointerId);
                    }
                    endPointerDrag(event.pointerId);
                  }}
                  onPointerCancel={(event) => {
                    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                      event.currentTarget.releasePointerCapture(event.pointerId);
                    }
                    endPointerDrag(event.pointerId);
                  }}
                  disabled={isPlaced || submitting}
                  tabIndex={isPlaced ? -1 : undefined}
                >
                  <span className="phrase-builder-token-text">{token.text}</span>
                </button>
              </span>
            );
          })}
        </div>
      </div>
      <div className="actions">
        <button type="button" className="secondary-button" onClick={resetPlacedTokens} disabled={submitting || placedCount === 0}>
          {t("word.partsReset")}
        </button>
      </div>
      {feedback && <p className={`word-input-feedback ${submitting ? "word-input-feedback-success" : "word-input-feedback-error"}`}>{feedback}</p>}
    </div>
  );
}
