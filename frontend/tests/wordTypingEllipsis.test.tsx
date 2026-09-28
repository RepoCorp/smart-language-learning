import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import WordReview from "../src/components/WordReview";
import { normalizeWordAnswer, resolveWordInputChange } from "../src/components/wordChallengeInputLogic";
import type { SessionItem } from "../src/types";

const item: SessionItem = {
  id: 17, item_type: "word", mode: "review", direction: "es_to_de",
  german_text: "so … wie", spanish_text: "tan ... como", options: [],
};

function type(value: string) {
  fireEvent.change(screen.getByTestId("word-input"), { target: { value } });
}

describe("ellipsis in typed expressions", () => {
  it("accepts three dots one at a time for a single ellipsis", () => {
    let acceptedAnswer = "so ";
    for (const char of "... wie") {
      const value = acceptedAnswer + char;
      const decision = resolveWordInputChange({
        value, acceptedAnswer, expectedAnswer: item.german_text, provisionalBaseAnswer: null,
      });
      expect(decision).toEqual({ kind: "accept", nextAnswer: value });
      acceptedAnswer = value;
    }
    expect(normalizeWordAnswer(acceptedAnswer)).toBe(normalizeWordAnswer(item.german_text));
  });

  it.each(["so … wie", "so ... wie"])("allows mobile smart punctuation for %s", (expectedAnswer) => {
    expect(resolveWordInputChange({ value: "so …", acceptedAnswer: "so ..", expectedAnswer, provisionalBaseAnswer: null }))
      .toEqual({ kind: "accept", nextAnswer: "so ..." });
  });

  it("does not accept incomplete punctuation, wrong letters or wrong capitalization", () => {
    expect(normalizeWordAnswer("so .. wie")).not.toBe(normalizeWordAnswer(item.german_text));
    for (const value of ["so ....", "so ... x", "So ... wie"]) {
      expect(resolveWordInputChange({ value, acceptedAnswer: "", expectedAnswer: item.german_text, provisionalBaseAnswer: null }).kind).toBe("reject");
    }
  });

  it.each([undefined, "word_intro"] as const)("completes typing without mistakes (%s)", async (repeatPracticeStep) => {
    const onAnswered = vi.fn();
    render(<WordReview item={{ ...item, repeatPracticeStep, repeatedAfterFailure: Boolean(repeatPracticeStep) }} onAnswered={onAnswered} />);
    let value = "";
    for (const char of "so ... wie") {
      value += char;
      type(value);
      expect(screen.getByTestId("word-input")).toHaveValue(value);
    }
    await waitFor(() => expect(onAnswered).toHaveBeenCalledWith(true));
  });

  it("waits for all three dots at the end of an expression", async () => {
    const onAnswered = vi.fn();
    render(<WordReview item={{ ...item, german_text: "und …" }} onAnswered={onAnswered} />);
    type("und .");
    expect(screen.getByTestId("word-input")).toHaveValue("und .");
    type("und ..");
    expect(onAnswered).not.toHaveBeenCalled();
    type("und ...");
    await waitFor(() => expect(onAnswered).toHaveBeenCalledWith(true));
  });

  it("offers an ordinary dot as the next hint", () => {
    render(<WordReview item={item} onAnswered={vi.fn()} />);
    type("so .");
    fireEvent.click(screen.getByRole("button", { name: "Hint" }));
    expect(screen.getByRole("button", { name: "." })).toBeInTheDocument();
    expect(screen.getByTestId("word-input")).toHaveValue("so .");
  });

  it("supports deletion and a clean rewrite through an ellipsis", () => {
    render(<WordReview item={item} onAnswered={vi.fn()} reviewComplete />);
    type("so .");
    expect(screen.getByTestId("word-input")).toHaveValue("so .");
    type("so ");
    expect(screen.getByTestId("word-input")).toHaveValue("so ");
    type("so … wie");
    expect(screen.getByTestId("word-input")).toHaveValue("so ... wie");
  });
});
