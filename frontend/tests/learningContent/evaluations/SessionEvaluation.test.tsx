import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import SessionEvaluation from "../../../src/features/learningContent/evaluations/SessionEvaluation";

it.each([
  { id: "unregistered", content: {} },
  { id: "toString", content: {} },
  { id: "affix_production", content: null },
  { id: "affix_production", content: {} },
  { id: "affix_recognition", content: null },
  { id: "affix_recognition", content: {} },
  { id: "affix_recognition", content: { base: "möglich", base_translation: "posible", word: "die Möglichkeit", answer: " " } },
  { id: "affix_production", content: { base: "a", base_translation: "a", meaning: "b", answer: "b", highlight: [0, 5] } },
])("rejects unavailable or malformed session evaluations without substituting content", payload => {
  render(<SessionEvaluation payload={payload} completed={false} disabled={false} onAnswered={vi.fn()} onNext={vi.fn()} />);
  expect(screen.getByRole("alert")).toHaveTextContent("This evaluation is not available yet.");
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
