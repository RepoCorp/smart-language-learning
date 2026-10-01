import { act, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { I18nProvider } from "../src/i18n";
import { StudyLanguagesProvider } from "../src/studyLanguages";
import { fetchWordFormationProgress, saveWordFormationPattern } from "../src/apiWordFormation";
import { quickAddWordFromDialog } from "../src/api";
import WordAddConfirmation from "../src/features/dialogs/components/WordAddConfirmation";
import { shouldOpenSavedWord } from "../src/features/dialogs/components/wordAddPreview";
import { useDialogItemSaving } from "../src/features/dialogs/components/useDialogItemSaving";
import useSavedDialogInteractions from "../src/features/content/create/components/useSavedDialogInteractions";

vi.mock("../src/apiWordFormation", () => ({ fetchWordFormationProgress: vi.fn(), saveWordFormationPattern: vi.fn() }));
vi.mock("../src/api", () => ({ quickAddWordFromDialog: vi.fn(), fetchContentItemDetail: vi.fn() }));

const item = { target: "die Möglichkeit", source: "la posibilidad", wordType: "noun" };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchWordFormationProgress).mockResolvedValue({ supported: true, saved: [] });
  vi.mocked(saveWordFormationPattern).mockResolvedValue(undefined);
});

it.each(["en", "es"])("offers -keit independently of saving the word (%s)", async language => {
  localStorage.setItem("app_language", language);
  const saveWord = vi.fn();
  render(<I18nProvider><WordAddConfirmation item={item} saving={false} onCancel={vi.fn()} onConfirm={saveWord} /></I18nProvider>);
  const card = screen.getByRole("article", { name: "-keit" });
  expect(card).toHaveTextContent("möglich");
  await userEvent.click(await within(card).findByRole("button", { name: language === "es" ? "Guardar patrón" : "Save pattern" }));
  expect(saveWordFormationPattern).toHaveBeenCalledWith("german_suffix_keit", "spanish", "german");
  expect(saveWord).not.toHaveBeenCalled();
  await waitFor(() => expect(within(card).getByRole("button")).toBeDisabled());
  await userEvent.click(screen.getByRole("button", { name: language === "es" ? "Agregar" : "Add" }));
  expect(saveWord).toHaveBeenCalledOnce();
});

it("locks the confirmation while saving and restores controls after failure", async () => {
  let reject!: (reason: Error) => void;
  vi.mocked(saveWordFormationPattern).mockReturnValue(new Promise((_, fail) => { reject = fail; }));
  render(<WordAddConfirmation item={item} saving={false} onCancel={vi.fn()} onConfirm={vi.fn()} />);
  await userEvent.click(await screen.findByRole("button", { name: "Save pattern" }));
  expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  await act(async () => reject(new Error("offline")));
  expect(screen.getByRole("alert")).toHaveTextContent("Could not save");
  expect(screen.getByRole("button", { name: "Save pattern" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Add" })).toBeEnabled();
});

it("loads previously saved status instead of offering a duplicate", async () => {
  vi.mocked(fetchWordFormationProgress).mockResolvedValue({ supported: true, saved: ["german_suffix_keit"] });
  render(<WordAddConfirmation item={item} saving={false} onCancel={vi.fn()} onConfirm={vi.fn()} />);
  expect(await screen.findByRole("button", { name: "In your learning deck" })).toBeDisabled();
  expect(saveWordFormationPattern).not.toHaveBeenCalled();
});

it("uses the English catalog when English is being learned", async () => {
  localStorage.setItem("study_target_language", "english");
  render(<StudyLanguagesProvider><WordAddConfirmation item={{ ...item, target: "the kindness" }} saving={false} onCancel={vi.fn()} onConfirm={vi.fn()} /></StudyLanguagesProvider>);
  await userEvent.click(await screen.findByRole("button", { name: "Save pattern" }));
  expect(saveWordFormationPattern).toHaveBeenCalledWith("english_suffix_ness", "spanish", "english");
});

it("does not invent a pattern for words without a match", async () => {
  render(<WordAddConfirmation item={{ ...item, target: "der Hund" }} saving={false} onCancel={vi.fn()} onConfirm={vi.fn()} />);
  expect(screen.queryByRole("article")).not.toBeInTheDocument();
  expect(fetchWordFormationProgress).not.toHaveBeenCalled();
  expect(await shouldOpenSavedWord({ created: false, exists: true, target_text: "der Hund", word_type: "noun" }, "spanish", "german")).toBe(true);
});

it("continues opening word details directly once its matching patterns are saved", async () => {
  vi.mocked(fetchWordFormationProgress).mockResolvedValue({ supported: true, saved: ["german_suffix_keit"] });
  expect(await shouldOpenSavedWord({ created: false, exists: true, target_text: item.target, word_type: "noun" }, "spanish", "german")).toBe(true);
});

it("does not guess saved status when loading it fails", async () => {
  vi.mocked(fetchWordFormationProgress).mockRejectedValue(new Error("offline"));
  await expect(shouldOpenSavedWord({ created: false, exists: true, target_text: item.target, word_type: "noun" }, "spanish", "german")).rejects.toThrow("offline");
});

function useDialogFlow() {
  const flow = useDialogItemSaving({ sourceLanguage: "spanish", targetLanguage: "german" });
  return { pending: flow.pendingWordAdd, init: () => {}, request: () => flow.requestAddWordFromDialogToken("word", "Möglichkeit", "Möglichkeit", 4, 0, "Hay una posibilidad.", "Es gibt eine Möglichkeit.") };
}

function useCreatedFlow() {
  const flow = useSavedDialogInteractions("spanish", "german", "failed");
  return { pending: flow.pendingWordAdd, init: () => flow.setSavedDialog(4, []), request: () => flow.requestAddWord("word", "Möglichkeit", 0, "Hay una posibilidad.", "Es gibt eine Möglichkeit.") };
}

it.each([useDialogFlow, useCreatedFlow])("keeps the pattern offer accessible for an already saved noun: %s", async hook => {
  vi.mocked(quickAddWordFromDialog).mockResolvedValue({ created: false, exists: true, id: 5,
    target_text: item.target, source_text: item.source, word_type: item.wordType });
  const { result } = renderHook(hook);
  act(() => result.current.init());
  await act(() => result.current.request());
  expect(result.current.pending?.target).toBe(item.target);
  expect(result.current.pending).toMatchObject({ wordSaved: true });
  expect(saveWordFormationPattern).not.toHaveBeenCalled();
});
