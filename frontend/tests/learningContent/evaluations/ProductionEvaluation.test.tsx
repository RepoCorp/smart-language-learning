import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import ItemView from "../../../src/features/learningContent/itemViews/ItemView";
import AffixProductionEvaluation from "../../../src/features/learningContent/patterns/affix/AffixProductionEvaluation";
import { keit } from "../fixtures";

const showModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
const close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true,
    value(this: HTMLDialogElement) { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true,
    value(this: HTMLDialogElement) { this.removeAttribute("open"); } });
});
afterAll(() => {
  for (const [key, original] of [["showModal", showModal], ["close", close]] as const) {
    if (original) Object.defineProperty(HTMLDialogElement.prototype, key, original);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, key);
  }
});
afterEach(() => vi.unstubAllGlobals());

it.each([
  ["en", "Open testing", "Testing", "Reveal answer", "Passed", "Failed", "Next example", "Close"],
  ["es", "Abrir pruebas", "Pruebas", "Mostrar respuesta", "Acertado", "Fallado", "Siguiente ejemplo", "Cerrar"],
] as const)("previews production in %s without persisting scores or making requests", (language, open, title, reveal, pass, fail, next, dismiss) => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  render(<ItemView definition={keit} sourceLanguage="spanish" interfaceLanguage={language} />);
  fireEvent.click(screen.getByRole("button", { name: open }));
  const modal = within(screen.getByRole("dialog", { name: title }));
  expect(modal.getByRole("combobox")).toHaveValue("source_to_target");
  expect(modal.getAllByRole("option")).toHaveLength(1);
  expect(modal.getByRole("option")).toHaveTextContent(language === "en" ? "Build a word" : "Forma una palabra");
  expect(modal.getByRole("combobox")).toHaveClass("word-strategies-select");
  expect(modal.getByRole("combobox").parentElement).toHaveClass("strategy-picker");
  expect(modal.getByText("möglich")).toBeInTheDocument();
  expect(modal.getByText(/«posibilidad»/)).toBeInTheDocument();
  expect(modal.queryByText(/Möglichkeit/)).not.toBeInTheDocument();
  expect(modal.queryByRole("button", { name: pass })).not.toBeInTheDocument();
  expect(modal.queryByRole("button", { name: next })).not.toBeInTheDocument();
  fireEvent.click(modal.getByRole("button", { name: reveal }));
  expect(modal.getByText("keit", { selector: "strong" }).parentElement).toHaveTextContent("die Möglichkeit");
  fireEvent.click(modal.getByRole("button", { name: pass }));
  expect(modal.getByRole("status")).toHaveTextContent(pass);
  expect(modal.queryByRole("button", { name: pass })).not.toBeInTheDocument();
  expect(modal.queryByRole("button", { name: fail })).not.toBeInTheDocument();
  fireEvent.click(modal.getByRole("button", { name: next }));
  expect(modal.getByText("sauber")).toBeInTheDocument();
  expect(modal.queryByText(/Sauberkeit/)).not.toBeInTheDocument();
  fireEvent.click(modal.getByRole("button", { name: reveal }));
  fireEvent.click(modal.getByRole("button", { name: fail }));
  expect(modal.getByRole("status")).toHaveTextContent(fail);
  fireEvent.click(modal.getByRole("button", { name: dismiss }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: open }));
  expect(within(screen.getByRole("dialog")).getByRole("button", { name: reveal })).toBeInTheDocument();
  fireEvent(screen.getByRole("dialog"), new Event("cancel", { bubbles: true, cancelable: true }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});

it("cycles through every curated example before repeating", () => {
  render(<AffixProductionEvaluation definition={keit} sourceLanguage="spanish" interfaceLanguage="en" />);
  for (const example of keit.examples) {
    expect(screen.getByText(example.base)).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reveal answer" }));
    expect(screen.getByText("keit", { selector: "strong" }).parentElement).toHaveTextContent(example.result);
    fireEvent.click(screen.getByRole("button", { name: "Failed" }));
    fireEvent.click(screen.getByRole("button", { name: "Next example" }));
  }
  expect(screen.getByText("möglich")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Reveal answer" })).toBeInTheDocument();
});

it("resets for translation changes and closes when switching definitions", () => {
  const { rerender } = render(<ItemView definition={keit} sourceLanguage="spanish" />);
  fireEvent.click(screen.getByRole("button", { name: "Open testing" }));
  fireEvent.click(screen.getByRole("button", { name: "Reveal answer" }));
  fireEvent.click(screen.getByRole("button", { name: "Passed" }));
  rerender(<ItemView definition={keit} sourceLanguage="english" interfaceLanguage="es" />);
  const modal = within(screen.getByRole("dialog", { name: "Pruebas" }));
  expect(modal.getByText(/«possibility»/)).toBeInTheDocument();
  expect(modal.queryByText(/Möglichkeit/)).not.toBeInTheDocument();
  expect(modal.getByRole("button", { name: "Mostrar respuesta" })).toBeInTheDocument();
  rerender(<ItemView definition={{ ...keit, key: "another", evaluations: {} }} sourceLanguage="english" />);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Open testing" })).toBeDisabled();
});

it.each(["unregistered", "toString", "__proto__"])("reports unknown evaluation %s without substitution", id => {
  render(<ItemView definition={{ ...keit, evaluations: { source_to_target: id } }} sourceLanguage="spanish" />);
  fireEvent.click(screen.getByRole("button", { name: "Open testing" }));
  const modal = within(screen.getByRole("dialog"));
  expect(modal.getByRole("alert")).toHaveTextContent("This evaluation is not available yet.");
  expect(modal.queryByRole("button", { name: "Reveal answer" })).not.toBeInTheDocument();
});

it.each([
  { ...keit, examples: [] },
  { ...keit, examples: [{ ...keit.examples[0], translations: {} }] },
])("rejects missing examples or translations without offering scoring", definition => {
  render(<AffixProductionEvaluation definition={definition} sourceLanguage="spanish" interfaceLanguage="en" />);
  expect(screen.getByRole("alert")).toHaveTextContent("This content is not available in your selected languages yet.");
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
