import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import ItemViewShell from "../../src/components/itemView/ItemViewShell";
import ItemActions from "../../src/components/itemView/ItemActions";
import ItemView from "../../src/features/learningContent/itemViews/ItemView";
import { keit } from "../learningContent/fixtures";

it("shows one close button before content and supplied actions after it", () => {
  const close = vi.fn();
  const action = vi.fn();
  render(<ItemViewShell onClose={close} closeLabel="Close" actions={<ItemActions groups={[
    { id: "custom", label: "Custom actions", actions: [
      { id: "example", label: "Open examples", icon: <svg aria-hidden="true" />, onClick: action },
    ] },
  ]} />}><h2>Content</h2></ItemViewShell>);
  const buttons = screen.getAllByRole("button");
  expect(buttons.map(button => button.getAttribute("aria-label"))).toEqual(["Close", "Open examples"]);
  expect(buttons[0].parentElement).toHaveClass("item-view-shell");
  expect(buttons[0].nextElementSibling).toBe(screen.getByRole("heading"));
  fireEvent.click(buttons[1]);
  expect(action).toHaveBeenCalledOnce();
  expect(close).not.toHaveBeenCalled();
  fireEvent.click(buttons[0]);
  expect(close).toHaveBeenCalledOnce();
});

it("does not invent close or action buttons when none are supplied", () => {
  const { container } = render(<ItemViewShell closeLabel="Close" actions={<ItemActions groups={[
    { id: "empty", label: "Empty", actions: [] },
  ]} />}><p>Content</p></ItemViewShell>);
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(container.querySelector(".item-actions-toolbar")).toBeNull();
});

it("lets the new affix view receive actions without word/phrase-specific behavior", () => {
  const action = vi.fn();
  render(<ItemView definition={keit} sourceLanguage="spanish" actions={{
    showMobileActionLabels: true,
    groups: [{ id: "explore", label: "Explore", actions: [
      { id: "examples", label: "Examples", icon: <svg aria-hidden="true" />, onClick: action },
    ] }],
  }} />);
  fireEvent.click(screen.getByRole("button", { name: "Examples" }));
  expect(action).toHaveBeenCalledOnce();
  expect(screen.getAllByRole("button")).toHaveLength(1);
});

it("keeps close available and localized even if the item view cannot render", () => {
  const close = vi.fn();
  render(<ItemView definition={{ ...keit, item_view: "unknown" }} sourceLanguage="spanish" interfaceLanguage="es" onClose={close} />);
  expect(screen.getByRole("alert")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
  expect(close).toHaveBeenCalledOnce();
});
