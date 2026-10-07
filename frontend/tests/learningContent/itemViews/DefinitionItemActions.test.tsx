import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import ItemView from "../../../src/features/learningContent/itemViews/ItemView";
import { keit } from "../fixtures";

it.each([
  ["en", ["Open strategies", "Open testing", "Open related dialogs", "Ask questions", "Dangerous actions"], "Close"],
  ["es", ["Abrir estrategias", "Abrir pruebas", "Abrir diálogos relacionados", "Hacer preguntas", "Acciones peligrosas"], "Cerrar"],
] as const)("shows inactive actions in %s while keeping Close active", (language, labels, closeLabel) => {
  const close = vi.fn();
  render(<ItemView definition={{ ...keit, strategies: [], evaluations: {} }} sourceLanguage="spanish" interfaceLanguage={language} onClose={close} />);
  const buttons = screen.getAllByRole("button");
  expect(buttons.map(button => button.getAttribute("aria-label"))).toEqual([closeLabel, ...labels]);
  for (const label of labels) {
    const button = screen.getByRole("button", { name: label });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", label);
    expect(button).toHaveAttribute("data-mobile-label", label);
    expect(button.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    fireEvent.click(button);
  }
  expect(close).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(buttons[buttons.length - 1].parentElement).toHaveClass("item-action-group-danger");
  expect(buttons[0]).toBeEnabled();
  fireEvent.click(buttons[0]);
  expect(close).toHaveBeenCalledOnce();
});
