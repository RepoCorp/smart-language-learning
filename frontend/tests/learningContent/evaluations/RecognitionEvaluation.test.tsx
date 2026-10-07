import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import AffixRecognitionEvaluation from "../../../src/features/learningContent/patterns/affix/AffixRecognitionEvaluation";
import DefinitionEvaluationsModal from "../../../src/features/learningContent/evaluations/DefinitionEvaluationsModal";
import { keit } from "../fixtures";

const showModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
const close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true,
    value(this: HTMLDialogElement) { this.open = true; } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true,
    value(this: HTMLDialogElement) { this.open = false; } });
});
afterAll(() => {
  for (const [key, original] of [["showModal", showModal], ["close", close]] as const) {
    if (original) Object.defineProperty(HTMLDialogElement.prototype, key, original);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, key);
  }
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it.each([
  ["en", "english", "If möglich is possible, what does «die Möglichkeit» mean?", "the possibility", "Reveal answer", "Passed", "Next example"],
  ["es", "spanish", "Si möglich significa posible, ¿qué significa «die Möglichkeit»?", "la posibilidad", "Mostrar respuesta", "Acertado", "Siguiente ejemplo"],
  ["en", "spanish", "If möglich is posible, what does «die Möglichkeit» mean?", "la posibilidad", "Reveal answer", "Passed", "Next example"],
] as const)("recognition in %s with %s translations is a read-only self-assessment", (interfaceLanguage, sourceLanguage, prompt, answer, reveal, pass, next) => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  render(<AffixRecognitionEvaluation definition={keit} interfaceLanguage={interfaceLanguage} sourceLanguage={sourceLanguage} />);
  expect(screen.getByText("die Möglichkeit").parentElement).toHaveTextContent(prompt);
  expect(screen.queryByText(answer)).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: pass })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: next })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: reveal }));
  expect(screen.getByText(answer)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: pass }));
  expect(screen.queryByRole("button", { name: pass })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: next }));
  expect(screen.getByText("die Sauberkeit")).toBeVisible();
  expect(screen.queryByText(answer)).not.toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});

it("cycles every recognition example after either score before repeating", () => {
  render(<AffixRecognitionEvaluation definition={keit} sourceLanguage="spanish" interfaceLanguage="en" />);
  keit.examples.forEach((example, index) => {
    const translation = example.translations.spanish!;
    expect(screen.getByText(example.result)).toBeVisible();
    expect(screen.queryByText(translation.result)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reveal answer" }));
    expect(screen.getByText(translation.result)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: index % 2 ? "Failed" : "Passed" }));
    fireEvent.click(screen.getByRole("button", { name: "Next example" }));
  });
  expect(screen.getByText("die Möglichkeit")).toBeVisible();
  expect(screen.queryByText("la posibilidad")).not.toBeInTheDocument();
});

it.each([
  { ...keit, examples: [] },
  { ...keit, examples: [{ ...keit.examples[0], translations: {} }] },
])("does not invent recognition content when examples or translations are missing", definition => {
  render(<AffixRecognitionEvaluation definition={definition} sourceLanguage="spanish" interfaceLanguage="en" />);
  expect(screen.getByRole("alert")).toHaveTextContent("This content is not available in your selected languages yet.");
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

it("selects either evaluation and resets the revealed answer when direction or translation changes", () => {
  const view = (sourceLanguage: string) => <DefinitionEvaluationsModal definition={keit} sourceLanguage={sourceLanguage} interfaceLanguage="en" onClose={vi.fn()} />;
  const { rerender } = render(view("spanish"));
  const modal = within(screen.getByRole("dialog"));
  expect(modal.getByRole("option", { name: "Understand a word" })).toBeInTheDocument();
  fireEvent.change(modal.getByRole("combobox"), { target: { value: "target_to_source" } });
  expect(modal.getByText("die Möglichkeit")).toBeVisible();
  fireEvent.click(modal.getByRole("button", { name: "Reveal answer" }));
  expect(modal.getByText("la posibilidad")).toBeVisible();
  rerender(view("english"));
  expect(modal.queryByText("the possibility")).not.toBeInTheDocument();
  expect(modal.getByRole("button", { name: "Reveal answer" })).toBeVisible();
  fireEvent.change(modal.getByRole("combobox"), { target: { value: "source_to_target" } });
  expect(modal.queryByText("die Möglichkeit")).not.toBeInTheDocument();
  expect(modal.getByText(/«the possibility»/)).toBeVisible();
});
