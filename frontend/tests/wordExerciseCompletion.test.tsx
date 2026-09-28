import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import WordReview from "../src/components/WordReview";
import WordPartsReview from "../src/components/WordPartsReview";
import { buildWordPartUnits } from "../src/components/wordParts";
import type { SessionItem } from "../src/types";

const item: SessionItem = {
  id: 42, item_type: "word", german_text: "arbeiten", spanish_text: "trabajar",
  mode: "review", direction: "es_to_de", repeatedAfterFailure: true,
  repeatPracticeStep: "word_intro", options: [],
};

describe("word exercise completion", () => {
  it.each([false, true])("shows the word meaning after warm-up with an example: %s", async (withExample) => {
    const exercise: SessionItem = { ...item, exercise_phrases: withExample ? {
      phrases: [{ target_text: "Wir arbeiten hier.", source_text: "Trabajamos aquí." }],
    } : undefined };
    const onAnswered = vi.fn().mockResolvedValue(undefined);
    const view = render(<WordReview item={exercise} onAnswered={onAnswered} />);
    expect(screen.queryByText("trabajar")).not.toBeInTheDocument();
    fireEvent.change(screen.getByTestId("word-input"), { target: { value: "arbeiten" } });
    expect(screen.getByText("trabajar")).toBeInTheDocument();
    await waitFor(() => expect(onAnswered).toHaveBeenCalledWith(true));
    view.rerender(<WordReview item={exercise} onAnswered={onAnswered} reviewComplete />);
    expect(screen.getByText("trabajar")).toBeInTheDocument();
    expect(screen.getByText("Perfect. You got it with no revealed letters.")).toHaveClass("word-input-feedback-success");
  });

  it("keeps word and sentence translations visible after failing the warm-up", async () => {
    const exercise: SessionItem = { ...item, exercise_phrases: {
      phrases: [{ target_text: "Wir arbeiten hier.", source_text: "Trabajamos aquí." }],
    } };
    const onAnswered = vi.fn().mockResolvedValue(undefined);
    const view = render(<WordReview item={exercise} onAnswered={onAnswered} />);
    fireEvent.click(screen.getByRole("button", { name: "Fail" }));
    await waitFor(() => expect(onAnswered).toHaveBeenCalledWith(false));
    view.rerender(<WordReview item={exercise} onAnswered={onAnswered} reviewComplete />);
    expect(screen.getByText("trabajar")).toBeInTheDocument();
    expect(screen.getByText(/Trabajamos aquí\./)).toBeInTheDocument();
  });

  it("shows meaning for an already completed warm-up", () => {
    render(<WordReview item={item} onAnswered={vi.fn()} reviewComplete />);
    expect(screen.getByText("trabajar")).toBeInTheDocument();
  });

  it("keeps block success green after submission, while wrong chunks are red", async () => {
    let finish!: () => void;
    const onAnswered = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const exercise = { ...item, repeatPracticeStep: "word_parts" as const };
    const { tokens } = buildWordPartUnits(item.german_text);
    const view = render(<WordPartsReview item={exercise} onAnswered={onAnswered} />);
    expect(screen.getByText("trabajar")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: tokens[1].text }));
    expect(view.container.querySelector(".word-input-feedback")).toHaveClass("word-input-feedback-error");
    for (const token of tokens) {
      fireEvent.click(screen.getByRole("button", { name: token.text }));
    }
    expect(screen.getByText("Correct")).toHaveClass("word-input-feedback-success");
    await waitFor(() => expect(onAnswered).toHaveBeenCalledWith(true));
    await act(async () => finish());
    expect(screen.getByText("Correct")).toHaveClass("word-input-feedback-success");
    view.rerender(<WordPartsReview item={exercise} onAnswered={onAnswered} reviewComplete />);
    expect(screen.getByText("Correct")).not.toHaveClass("word-input-feedback-error");
    expect(screen.getByText("trabajar")).toBeInTheDocument();
  });
});
