import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import PatternItem from "../src/components/session/PatternItem";
import ManageItemsSection from "../src/features/content/manage/components/ManageItemsSection";
import type { SessionItem } from "../src/types";

const item: SessionItem = {
  id: 2, item_type: "pattern", german_text: "un-", spanish_text: "Patrón", mode: "new", options: [],
  pattern_key: "german_prefix_un", pattern_examples: [
    { base: "glücklich", base_translation: "feliz", answer: "unglücklich", meaning: "infeliz", question: "", highlight: [0, 2] },
  ],
};

it("shows the explanation and translated examples in details, with a working close button", () => {
  const close = vi.fn();
  const confirm = vi.fn();
  render(<PatternItem item={item} onClose={close} readOnly onContinue={confirm} />);
  expect(screen.getByText(/Un- often adds/)).toBeInTheDocument();
  expect(screen.getByText("feliz → infeliz")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Got it" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(close).toHaveBeenCalledOnce();
  expect(confirm).not.toHaveBeenCalled();
});

it("lets learners select and open patterns in management without offering audio generation", () => {
  const open = vi.fn();
  const select = vi.fn();
  render(<ManageItemsSection currentSection="patterns" items={[{ ...item, created_at: "", next_review_days: null, is_new: true }]}
    selectedItems={{}} busy={false} deletingItemId={null} regeneratingAudioItemId={null}
    onToggleAllItems={vi.fn()} allItemsSelected={false} onRemoveSelectedItems={vi.fn()}
    onToggleItemSelection={select} onOpenItemModal={open} onRegenerateAudio={vi.fn()} />);
  expect(screen.getByRole("heading", { name: "Patterns" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "un- - Patrón" }));
  expect(open).toHaveBeenCalledWith(2);
  fireEvent.click(screen.getByRole("checkbox"));
  expect(select).toHaveBeenCalledWith(2);
  expect(screen.queryByRole("button", { name: /Regenerate audio/ })).not.toBeInTheDocument();
});
