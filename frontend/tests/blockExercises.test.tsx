import { fireEvent, render, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PhraseReview from "../src/components/PhraseReview";
import WordPartsReview from "../src/components/WordPartsReview";
import ProgressivePhraseBlocksReview from "../src/components/phraseBuilder/ProgressivePhraseBlocksReview";
import type { SessionItem } from "../src/types";

const item: SessionItem = {
  id: 1, item_type: "word", spanish_text: "trabajo", german_text: "arbeiten",
  mode: "review", direction: "es_to_de", repeatedAfterFailure: true,
  repeatPracticeStep: "word_parts", options: [],
};
const sourceRect = { left: 100, top: 100, right: 180, bottom: 140, width: 80, height: 40 } as DOMRect;
const targetRect = { left: 100, top: 300, right: 200, bottom: 350, width: 100, height: 50 } as DOMRect;

function pointer(element: Element, type: string, x: number, y: number, pointerType = "touch") {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, cancelable: true });
  Object.defineProperties(event, { pointerId: { value: 1 }, pointerType: { value: pointerType } });
  fireEvent(element, event);
}

beforeEach(() => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    return this.classList.contains("phrase-builder-slot") ? targetRect : sourceRect;
  });
  Object.defineProperties(HTMLElement.prototype, {
    setPointerCapture: { configurable: true, value: vi.fn() },
    releasePointerCapture: { configurable: true, value: vi.fn() },
    hasPointerCapture: { configurable: true, value: () => false },
  });
});

it("preserves the next-word exercise's top options and lifted touch drop", () => {
  const { container } = render(<ProgressivePhraseBlocksReview
    promptText="Trabajo aquí" expectedAnswer="Ich arbeite hier" targetLanguage="german"
    phraseKey="test" distractorTexts={[]} isSubmitting={false} reviewComplete={false}
    hasAudio={false} onComplete={vi.fn().mockResolvedValue(undefined)} onReplayAudio={vi.fn().mockResolvedValue(false)}
  />);
  const bank = container.querySelector(".phrase-builder-bank")!;
  const target = container.querySelector(".phrase-builder-target-zone")!;
  expect(bank.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  const correct = within(bank as HTMLElement).getByRole("button", { name: "Ich" });
  pointer(correct, "pointerdown", 140, 120);
  expect(correct).toHaveStyle({ left: "100px", top: "57px" });
  pointer(correct, "pointerup", 150, 325);
  expect(target.querySelector(".phrase-builder-slot-filled")).toHaveTextContent("Ich");
  expect(container.querySelector(".phrase-builder-token-dragging")).toBeNull();
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function setup(kind: "word" | "phrase") {
  const onAnswered = vi.fn().mockResolvedValue(undefined);
  const view = render(kind === "word"
    ? <WordPartsReview item={item} onAnswered={onAnswered} />
    : <PhraseReview item={{ ...item, item_type: "phrase", german_text: "Ich arbeite hier", repeatPracticeStep: "phrase_builder" }} onAnswered={onAnswered} />);
  const bank = view.container.querySelector(".phrase-builder-bank")!;
  const slot = view.container.querySelector('[data-slot-index="0"]')!;
  const text = slot.querySelector(".phrase-builder-slot-size")!.textContent!;
  const correct = within(bank as HTMLElement).getByRole("button", { name: text });
  const wrong = within(bank as HTMLElement).getAllByRole("button").find(button => button !== correct)!;
  return { ...view, bank, slot, correct, wrong, onAnswered };
}

describe.each(["word", "phrase"] as const)("%s blocks", (kind) => {
  it.each(["mouse", "touch"])("follows the %s directly without attraction near the destination", (pointerType) => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    const { correct, slot } = setup(kind);
    pointer(correct, "pointerdown", 140, 120, pointerType);
    expect(correct).toHaveStyle({ top: pointerType === "mouse" ? "100px" : "57px" });
    pointer(correct, "pointermove", 150, 260, pointerType);
    expect(correct).toHaveStyle({ left: "110px", top: pointerType === "mouse" ? "225px" : "197px" });
    expect(slot).not.toHaveClass("phrase-builder-slot-filled");
    pointer(correct, "pointermove", 150, 325, pointerType);
    expect(slot).toHaveClass("phrase-builder-slot-filled");
    expect(correct).not.toHaveClass("phrase-builder-token-dragging");
  });

  it("does not place an overlapping block until the mouse itself reaches the target", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    const { correct, slot } = setup(kind);
    pointer(correct, "pointerdown", 140, 120, "mouse");
    pointer(correct, "pointermove", 150, 355, "mouse");
    expect(correct).toHaveStyle({ left: "110px", top: "320px" });
    expect(slot).not.toHaveClass("phrase-builder-slot-filled");
    pointer(correct, "pointerup", 150, 355, "mouse");
    expect(slot).not.toHaveClass("phrase-builder-slot-filled");
    expect(correct).not.toHaveClass("phrase-builder-token-dragging");
  });

  it("puts options before the destination and lifts immediately on touch", () => {
    const { bank, slot, correct } = setup(kind);
    expect(bank.compareDocumentPosition(slot) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    pointer(correct, "pointerdown", 140, 120);
    expect(correct).toHaveStyle({ left: "100px", top: "57px" });
    expect(correct).toHaveClass("phrase-builder-token-dragging");
  });

  it("accepts the finger over the target, including pointerup without a move", () => {
    const { slot, correct } = setup(kind);
    pointer(correct, "pointerdown", 140, 120);
    pointer(correct, "pointerup", 150, 325);
    expect(slot).toHaveClass("phrase-builder-slot-filled");
    expect(correct).not.toHaveClass("phrase-builder-token-dragging");
  });

  it("does not highlight the destination for a wrong block", () => {
    const { slot, wrong } = setup(kind);
    pointer(wrong, "pointerdown", 140, 120);
    pointer(wrong, "pointermove", 150, 260);
    expect(slot).not.toHaveClass("phrase-builder-slot-latching");
    expect(slot).not.toHaveClass("phrase-builder-slot-filled");
  });

  it("cleans up when pointer capture is lost", () => {
    const { correct, slot } = setup(kind);
    pointer(correct, "pointerdown", 140, 120);
    pointer(correct, "lostpointercapture", 140, 120);
    expect(correct).not.toHaveClass("phrase-builder-token-dragging");
    expect(slot).not.toHaveClass("phrase-builder-slot-filled");
  });

  it("places only the correct next block and leaves completion pending", () => {
    const { slot, correct, wrong, onAnswered } = setup(kind);
    pointer(wrong, "pointerdown", 140, 120);
    pointer(wrong, "pointermove", 150, 325);
    pointer(wrong, "pointerup", 150, 325);
    expect(slot).not.toHaveClass("phrase-builder-slot-filled");
    pointer(correct, "pointerdown", 140, 120);
    pointer(correct, "pointermove", 150, 325);
    pointer(correct, "pointerup", 150, 325);
    expect(slot).toHaveClass("phrase-builder-slot-filled");
    expect(onAnswered).not.toHaveBeenCalled();
  });

  it("returns cancelled and outside drops to the options", () => {
    const { slot, correct } = setup(kind);
    pointer(correct, "pointerdown", 140, 120);
    pointer(correct, "pointercancel", 140, 120);
    expect(correct).not.toHaveClass("phrase-builder-token-dragging");
    pointer(correct, "pointerdown", 140, 120);
    pointer(correct, "pointerup", 500, 500);
    expect(correct).not.toHaveClass("phrase-builder-token-dragging");
    expect(slot).not.toHaveClass("phrase-builder-slot-filled");
  });
});
