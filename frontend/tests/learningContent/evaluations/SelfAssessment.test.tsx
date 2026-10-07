import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import SelfAssessment from "../../../src/features/learningContent/evaluations/SelfAssessment";

it.each(["Passed", "Failed"])("handles %s without knowing the content type", result => {
  const next = vi.fn();
  render(<SelfAssessment prompt={<p>Any question</p>} answer={<p>Any answer</p>} language="en" onNext={next} />);
  expect(screen.queryByText("Any answer")).not.toBeInTheDocument();
  expect(screen.getAllByRole("button")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Reveal answer" }));
  expect(screen.getByText("Any answer")).toBeInTheDocument();
  expect(screen.getAllByRole("button")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: result }));
  expect(screen.getByRole("status")).toHaveTextContent(result);
  expect(next).not.toHaveBeenCalled();
  expect(screen.getAllByRole("button")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Next example" }));
  expect(next).toHaveBeenCalledOnce();
});

it("locks scoring during a request and only completes after success", async () => {
  let finish!: () => void;
  const save = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
  render(<SelfAssessment prompt="Question" answer="Answer" language="en" onNext={vi.fn()} onAnswered={save} />);
  fireEvent.click(screen.getByRole("button", { name: "Reveal answer" }));
  fireEvent.click(screen.getByRole("button", { name: "Failed" }));
  expect(screen.getByRole("button", { name: "Passed" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Failed" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Failed" }));
  expect(save).toHaveBeenCalledTimes(1);
  expect(save).toHaveBeenCalledWith(false);
  expect(screen.queryByRole("button", { name: "Next example" })).not.toBeInTheDocument();
  await act(async () => finish());
  expect(screen.getByRole("button", { name: "Next example" })).toBeInTheDocument();
});

it("respects session disable and restored completion without posting a result", () => {
  const save = vi.fn();
  const { rerender } = render(<SelfAssessment prompt="Question" answer="Answer" language="en" onNext={vi.fn()} onAnswered={save} disabled />);
  expect(screen.getByRole("button", { name: "Reveal answer" })).toBeDisabled();
  rerender(<SelfAssessment prompt="Question" answer="Answer" language="en" onNext={vi.fn()} onAnswered={save} completed disabled
    nextLabel="Next" postReviewActions={<button>Open details</button>} />);
  expect(screen.getByText("Answer")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Open details" })).toBeInTheDocument();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(save).not.toHaveBeenCalled();
});
