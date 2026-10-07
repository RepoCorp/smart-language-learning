import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import DialogItemSavingModals from "../src/features/dialogs/components/DialogItemSavingModals";
import SavedDialogModals from "../src/features/content/create/components/SavedDialogModals";

vi.mock("../src/components/LegacyItemView", () => ({ default: () => null }));

const pending = {
  key: "word", source: "venir", target: "kommen", wordType: "verb", turnIndex: 0,
  sourceLine: "Viene.", targetLine: "Er kommt.", clickedTargetToken: "kommt", note: "",
};

it.each(["dialogs", "created"])("preserves word confirmation in %s", async (place) => {
  const confirm = vi.fn(async () => {});
  const cancel = vi.fn();
  const view = (addingWord: boolean) => place === "dialogs"
    ? <DialogItemSavingModals pendingWordAdd={pending} addingWord={addingWord} openedItemContent={null} onCancelWordAdd={cancel} onConfirmWordAdd={confirm} />
    : <SavedDialogModals pendingWordAdd={pending} addingWord={addingWord} openedLinkedWord={null} loadingLinkedWord={false} onClosePendingWordAdd={cancel} onConfirmWordAdd={confirm} onCloseOpenedLinkedWord={vi.fn()} />;
  const { rerender } = render(view(false));
  expect(screen.getByText("kommen")).toBeVisible();
  expect(screen.getByText(/venir/)).toBeVisible();
  expect(confirm).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Add" }));
  expect(confirm).toHaveBeenCalledOnce();
  await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(cancel).toHaveBeenCalledOnce();
  rerender(view(true));
  expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  expect(screen.getAllByRole("button").every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
});
