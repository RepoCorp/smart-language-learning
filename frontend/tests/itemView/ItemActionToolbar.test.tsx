import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import ItemActionToolbar from "../../src/components/ItemActionToolbar";

function props() {
  return {
    itemType: "word" as "word" | "phrase", loadingExercises: false,
    showMobileActionLabels: true, hasQuestions: true, hasCompareWordsContent: true,
    onOpenExercises: vi.fn(), onOpenTesting: vi.fn(), onOpenRelatedDialogs: vi.fn(),
    onOpenQuestions: vi.fn(), onOpenCompareWords: vi.fn(), onOpenAdminActions: vi.fn(),
    onShowTooltip: vi.fn(), onHideTooltip: vi.fn(),
  };
}

afterEach(() => vi.unstubAllGlobals());

it("keeps all word actions in order, with labels, icons and the dangerous group separator", () => {
  const callbacks = props();
  const { container } = render(<ItemActionToolbar {...callbacks} />);
  const buttons = screen.getAllByRole("button");
  expect(buttons).toHaveLength(6);
  const handlers = [callbacks.onOpenExercises, callbacks.onOpenTesting, callbacks.onOpenRelatedDialogs,
    callbacks.onOpenQuestions, callbacks.onOpenCompareWords, callbacks.onOpenAdminActions];
  buttons.forEach((button, index) => {
    const label = button.getAttribute("aria-label");
    expect(label).toBeTruthy();
    expect(button).toHaveAttribute("title", label);
    expect(button).toHaveAttribute("data-mobile-label", label);
    expect(button.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    fireEvent.click(button);
    expect(handlers[index]).toHaveBeenCalledOnce();
  });
  expect(buttons[3]).toHaveClass("item-action-button-has-content");
  expect(buttons[4]).toHaveClass("item-action-button-has-content");
  expect(buttons[5].parentElement).toHaveClass("item-action-group-danger");
  expect(container.querySelector(".mobile-action-labels-expanded")).not.toBeNull();
});

it("omits word comparison for phrases", () => {
  const callbacks = props();
  render(<ItemActionToolbar {...callbacks} itemType="phrase" />);
  expect(screen.getAllByRole("button")).toHaveLength(5);
  for (const button of screen.getAllByRole("button")) fireEvent.click(button);
  expect(callbacks.onOpenCompareWords).not.toHaveBeenCalled();
});

it("disables only practice actions while exercises load", () => {
  const callbacks = props();
  render(<ItemActionToolbar {...callbacks} loadingExercises />);
  const buttons = screen.getAllByRole("button");
  expect(buttons[0]).toBeDisabled();
  expect(buttons[1]).toBeDisabled();
  buttons.slice(2).forEach(button => expect(button).toBeEnabled());
  fireEvent.click(buttons[0]);
  fireEvent.click(buttons[1]);
  expect(callbacks.onOpenExercises).not.toHaveBeenCalled();
  expect(callbacks.onOpenTesting).not.toHaveBeenCalled();
});

it("preserves pointer and keyboard tooltip events", () => {
  const callbacks = props();
  render(<ItemActionToolbar {...callbacks} />);
  const button = screen.getAllByRole("button")[0];
  fireEvent.pointerEnter(button);
  fireEvent.focus(button);
  expect(callbacks.onShowTooltip).toHaveBeenCalledTimes(2);
  expect(callbacks.onShowTooltip.mock.calls[0][1]).toBe(button.getAttribute("aria-label"));
  fireEvent.pointerLeave(button);
  fireEvent.blur(button);
  expect(callbacks.onHideTooltip).toHaveBeenCalledTimes(2);
});

it("suppresses an accidental click after horizontal dragging, but permits the next tap", () => {
  vi.stubGlobal("PointerEvent", MouseEvent);
  const callbacks = props();
  render(<ItemActionToolbar {...callbacks} />);
  const button = screen.getAllByRole("button")[0];
  fireEvent.pointerDown(button, { clientX: 10, clientY: 10 });
  fireEvent.pointerMove(button, { clientX: 50, clientY: 11 });
  fireEvent.pointerUp(button);
  fireEvent.click(button);
  expect(callbacks.onOpenExercises).not.toHaveBeenCalled();
  fireEvent.pointerDown(button, { clientX: 10, clientY: 10 });
  fireEvent.pointerUp(button);
  fireEvent.click(button);
  expect(callbacks.onOpenExercises).toHaveBeenCalledOnce();
});
