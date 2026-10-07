import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import ItemView from "../../../src/features/learningContent/itemViews/ItemView";
import { keit } from "../fixtures";

const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true,
    value(this: HTMLDialogElement) { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true,
    value(this: HTMLDialogElement) { this.removeAttribute("open"); } });
});
afterAll(() => {
  for (const [key, original] of [["showModal", originalShowModal], ["close", originalClose]] as const) {
    if (original) Object.defineProperty(HTMLDialogElement.prototype, key, original);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, key);
  }
});
afterEach(() => vi.unstubAllGlobals());

it.each([
  ["en", "Open strategies", "Strategies", "Examples", "Close"],
  ["es", "Abrir estrategias", "Estrategias", "Ejemplos", "Cerrar"],
] as const)("opens all hardcoded examples in %s without generation", (language, open, title, examples, close) => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  render(<ItemView definition={keit} sourceLanguage="spanish" interfaceLanguage={language} />);
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
  const buttons = screen.getAllByRole("button");
  expect(buttons[0]).toBeEnabled();
  expect(buttons[1]).toBeEnabled();
  buttons.slice(2).forEach(button => expect(button).toBeDisabled());
  fireEvent.click(screen.getByRole("button", { name: open }));
  const modal = within(screen.getByRole("dialog", { name: title }));
  expect(modal.getByRole("combobox", { name: title })).toHaveValue("affix_examples");
  expect(modal.getAllByRole("option").map(option => option.textContent)).toEqual([examples]);
  expect(modal.getAllByRole("listitem")).toHaveLength(6);
  const last = modal.getAllByRole("listitem")[5];
  expect(last).toHaveTextContent("einsam → die Einsamkeit");
  expect(within(last).getByText("keit", { selector: "strong" })).toBeInTheDocument();
  expect(last).toHaveTextContent("solitario → la soledad");
  expect(modal.getAllByRole("button")).toHaveLength(1);
  fireEvent.click(modal.getByRole("button", { name: close }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: open }));
  expect(within(screen.getByRole("dialog")).getAllByRole("listitem")).toHaveLength(6);
  fireEvent(screen.getByRole("dialog"), new Event("cancel", { bubbles: true, cancelable: true }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});

it("updates translations while open and closes the strategy when the definition changes", () => {
  const { rerender } = render(<ItemView definition={keit} sourceLanguage="spanish" />);
  fireEvent.click(screen.getByRole("button", { name: "Open strategies" }));
  rerender(<ItemView definition={keit} sourceLanguage="english" interfaceLanguage="es" />);
  const modal = within(screen.getByRole("dialog", { name: "Estrategias" }));
  expect(modal.getByText("lonely → the loneliness")).toBeInTheDocument();
  expect(modal.queryByText("solitario → la soledad")).not.toBeInTheDocument();
  rerender(<ItemView definition={{ ...keit, key: "another", strategies: [] }} sourceLanguage="english" />);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Open strategies" })).toBeDisabled();
});

it.each(["examples", "toString", "__proto__"])("does not substitute a word strategy for an unknown identifier: %s", id => {
  render(<ItemView definition={{ ...keit, strategies: [id] }} sourceLanguage="spanish" />);
  fireEvent.click(screen.getByRole("button", { name: "Open strategies" }));
  const modal = within(screen.getByRole("dialog"));
  expect(modal.getByRole("alert")).toHaveTextContent("This strategy is not available yet.");
  expect(modal.queryByRole("list")).not.toBeInTheDocument();
});

it("reports missing translations without substituting another language", () => {
  render(<ItemView definition={keit} sourceLanguage="french" />);
  fireEvent.click(screen.getByRole("button", { name: "Open strategies" }));
  const modal = within(screen.getByRole("dialog"));
  expect(modal.getByRole("alert")).toHaveTextContent("This content is not available in your selected languages yet.");
  expect(modal.queryByRole("list")).not.toBeInTheDocument();
});
