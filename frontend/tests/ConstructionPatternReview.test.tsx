import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import PatternReview from "../src/components/session/PatternReview";
import PatternItem from "../src/components/session/PatternItem";
import { I18nProvider } from "../src/i18n";
import type { SessionItem } from "../src/types";

const entry: SessionItem = {
  id: 12, item_type: "pattern", mode: "review", direction: "es_to_de", options: [],
  pattern_key: "future_with_werden", german_text: "werden + Infinitiv", spanish_text: "Hablar del futuro",
  notes: "Este patrón sirve para hablar de algo que ocurrirá después.", example_sentence: "Er wird kommen.",
  exercise_phrases: { generation_mode: "construction_pattern" }, review_version: 0,
};

it.each(["es_to_de", "de_to_es"] as const)("reveals and self-rates the construction in direction %s", async direction => {
  const item = { ...entry, direction };
  const answered = vi.fn().mockResolvedValue(undefined), next = vi.fn();
  const view = (completed: boolean) => <PatternReview item={item} completed={completed} disabled={false} onAnswered={answered} onNext={next} postReviewActions={<button>Open details</button>} />;
  const { rerender } = render(view(false));
  expect(screen.getByText("Do you know this pattern?")).toBeVisible();
  const prompt = direction === "de_to_es" ? item.german_text : item.notes!;
  const answer = direction === "de_to_es" ? item.notes! : item.german_text;
  expect(screen.getByText(prompt)).toBeVisible();
  expect(screen.queryByText(answer)).not.toBeInTheDocument();
  expect(screen.queryByText(item.example_sentence!)).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Passed" })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Reveal answer" }));
  expect(screen.getByText(answer)).toBeVisible();
  expect(screen.getByText(item.example_sentence!)).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: direction === "es_to_de" ? "Passed" : "Failed" }));
  expect(answered).toHaveBeenCalledWith(direction === "es_to_de");
  rerender(view(true));
  expect(screen.queryByRole("button", { name: "Passed" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Open details" })).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(next).toHaveBeenCalledOnce();
});

it("keeps answers visible and offers retry after a failed review request", async () => {
  let reject!: (reason: Error) => void;
  const answered = vi.fn().mockReturnValue(new Promise((_, fail) => { reject = fail; }));
  render(<PatternReview item={entry} completed={false} disabled={false} onAnswered={answered} onNext={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: "Reveal answer" }));
  await userEvent.click(screen.getByRole("button", { name: "Passed" }));
  expect(screen.getByRole("button", { name: "Failed" })).toBeDisabled();
  await act(async () => reject(new Error("offline")));
  expect(screen.getByRole("alert")).toBeVisible();
  expect(screen.getByText(entry.german_text)).toBeVisible();
  expect(screen.getByRole("button", { name: "Passed" })).toBeEnabled();
});

it("localizes the check and supports restored completed reviews", () => {
  localStorage.setItem("app_language", "es");
  render(<I18nProvider><PatternReview item={entry} completed disabled={false} onAnswered={vi.fn()} onNext={vi.fn()} /></I18nProvider>);
  expect(screen.getByText("¿Conoces este patrón?")).toBeVisible();
  expect(screen.getByText(entry.german_text)).toBeVisible();
  expect(screen.getByText(entry.example_sentence!)).toBeVisible();
});

it("allows a newly introduced construction to be confirmed", async () => {
  const seen = vi.fn().mockResolvedValue(undefined);
  render(<PatternItem item={{ ...entry, mode: "new", direction: null }} onContinue={seen} continueLabel="Continue" />);
  expect(screen.getByText(entry.notes!)).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(seen).toHaveBeenCalledOnce();
});
