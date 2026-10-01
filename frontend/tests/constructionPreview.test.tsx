import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { quickAddWordFromDialog } from "../src/api";
import { I18nProvider } from "../src/i18n";
import WordAddConfirmation from "../src/features/dialogs/components/WordAddConfirmation";
import { wordAddPreview, type ConstructionPatternPreview, type WordAddPreview } from "../src/features/dialogs/components/wordAddPreview";
import { useDialogItemSaving } from "../src/features/dialogs/components/useDialogItemSaving";
import useSavedDialogInteractions from "../src/features/content/create/components/useSavedDialogInteractions";
import { saveConstructionPattern } from "../src/apiConstructionPatterns";
import PatternItem from "../src/components/session/PatternItem";
import type { SessionItem } from "../src/types";

vi.mock("../src/api", () => ({ quickAddWordFromDialog: vi.fn(), fetchContentItemDetail: vi.fn(), quickAddPhraseFromConversation: vi.fn() }));
vi.mock("../src/apiConstructionPatterns", () => ({ saveConstructionPattern: vi.fn() }));

const pattern: ConstructionPatternPreview = {
  key: "future_with_werden", form: "werden + Infinitiv", meaning: "Hablar del futuro",
  explanation: "Aquí wird junto con kommen habla de una acción futura.",
  example: "Er wird kommen.", matched_parts: ["wird", "kommen"], replaces_word: true, save_token: "signed-preview",
};

beforeEach(() => vi.clearAllMocks());

it.each(["en", "es"])("saves a construction independently and keeps the preview open (%s)", async (language) => {
  localStorage.setItem("app_language", language);
  const close = vi.fn(), save = vi.fn();
  render(<I18nProvider><WordAddConfirmation item={wordAddPreview({ created: false, exists: false, item_type: "pattern", construction_pattern: pattern })}
    saving={false} onCancel={close} onConfirm={save} /></I18nProvider>);
  expect(screen.getByText(pattern.form)).toBeVisible();
  expect(screen.getByText(pattern.explanation)).toBeVisible();
  expect(screen.getByText(pattern.example)).toBeVisible();
  expect(screen.queryByText(pattern.key)).not.toBeInTheDocument();
  vi.mocked(saveConstructionPattern).mockResolvedValue(42);
  await userEvent.click(screen.getByRole("button", { name: language === "es" ? "Guardar patrón" : "Save pattern" }));
  expect(saveConstructionPattern).toHaveBeenCalledWith("signed-preview");
  expect(screen.getByRole("status")).toBeVisible();
  expect(close).not.toHaveBeenCalled();
  expect(screen.getAllByRole("button")).toHaveLength(1);
  await userEvent.click(screen.getByRole("button", { name: language === "es" ? "Cerrar" : "Close" }));
  expect(close).toHaveBeenCalledOnce();
  expect(save).not.toHaveBeenCalled();
});

it("does not report success on a failed save and permits retry", async () => {
  vi.mocked(saveConstructionPattern).mockRejectedValueOnce(new Error("Failed")).mockResolvedValueOnce(42);
  render(<WordAddConfirmation item={wordAddPreview({ created: false, exists: false, construction_pattern: pattern })}
    saving={false} onCancel={vi.fn()} onConfirm={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: "Save pattern" }));
  expect(screen.getByRole("alert")).toBeVisible();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Save pattern" }));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toBeVisible();
});

it("shows a previously saved pattern without offering another save", () => {
  render(<WordAddConfirmation item={wordAddPreview({ created: false, exists: false,
    construction_pattern: { ...pattern, saved_id: 42 } })} saving={false} onCancel={vi.fn()} onConfirm={vi.fn()} />);
  expect(screen.queryByRole("button", { name: "Save pattern" })).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toBeVisible();
});

it("displays read-only construction details without a session action", async () => {
  const close = vi.fn();
  render(<PatternItem item={{ id: 42, item_type: "pattern", pattern_key: pattern.key,
    german_text: pattern.form, notes: pattern.explanation, example_sentence: pattern.example,
    exercise_phrases: { generation_mode: "construction_pattern" } } as SessionItem}
    readOnly onClose={close} onContinue={vi.fn()} />);
  expect(screen.getByText(pattern.explanation)).toBeVisible();
  expect(screen.getByText(pattern.example)).toBeVisible();
  expect(screen.getAllByRole("button")).toHaveLength(1);
  await userEvent.click(screen.getByRole("button"));
  expect(close).toHaveBeenCalledOnce();
});

it("keeps Add for the full separable verb, alongside its pattern explanation", async () => {
  const save = vi.fn();
  render(<WordAddConfirmation item={wordAddPreview({
    created: false, exists: false, source_text: "levantarse", target_text: "aufstehen", word_type: "verb",
    construction_pattern: { ...pattern, key: "separable_verb", replaces_word: false, explanation: "Las dos partes forman el verbo." },
  })} saving={false} onCancel={vi.fn()} onConfirm={save} />);
  expect(screen.getByText("aufstehen")).toBeVisible();
  expect(screen.getByText("Las dos partes forman el verbo.")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Add" }));
  expect(save).toHaveBeenCalledOnce();
});

it("does not disguise incomplete word metadata as a successful preview", () => {
  expect(() => wordAddPreview({ created: false, exists: false, word_type: "verb" })).toThrow();
});

type Flow = {
  pending: WordAddPreview | null;
  confirm: () => Promise<void>;
  initialize: () => void;
  request: () => Promise<void>;
  close: () => void;
  status: Record<string, string>;
};

function useCreatedFlow(): Flow {
  const saved = useSavedDialogInteractions("spanish", "german", "failed");
  return {
    pending: saved.pendingWordAdd, confirm: saved.confirmAddWord,
    initialize: () => saved.setSavedDialog(4, []),
    request: () => saved.requestAddWord("word", "wird", 0, "Vendrá.", "Er wird kommen."),
    close: saved.closePendingWordAdd, status: saved.wordActionStatus,
  };
}

function useDialogFlow(): Flow {
  const saved = useDialogItemSaving({ sourceLanguage: "spanish", targetLanguage: "german" });
  return {
    pending: saved.pendingWordAdd, confirm: saved.confirmAddWordFromDialog,
    initialize: () => {},
    request: () => saved.requestAddWordFromDialogToken("word", "wird", "wird", 4, 0, "Vendrá.", "Er wird kommen."),
    close: () => saved.setPendingWordAdd(null), status: saved.wordActionStatus,
  };
}

it.each([useCreatedFlow, useDialogFlow])("carries a construction preview through %s without calling save", async (hook) => {
  vi.mocked(quickAddWordFromDialog).mockResolvedValue({ created: false, exists: false, item_type: "pattern", construction_pattern: pattern });
  const { result } = renderHook(hook);
  act(() => result.current.initialize());
  await act(() => result.current.request());
  expect(result.current.pending?.construction).toEqual(pattern);
  expect(result.current.status.word).toBe("idle");
  await act(() => result.current.confirm());
  expect(quickAddWordFromDialog).toHaveBeenCalledOnce();
  act(() => result.current.close());
  expect(result.current.pending).toBeNull();
});

it.each([useCreatedFlow, useDialogFlow])("offers an unsaved pattern even when the verb already exists: %s", async (hook) => {
  vi.mocked(quickAddWordFromDialog).mockResolvedValue({ created: false, exists: true, id: 10,
    source_text: "levantarse", target_text: "aufstehen", word_type: "verb",
    construction_pattern: { ...pattern, key: "separable_verb", replaces_word: false, saved_id: null } });
  const { result } = renderHook(hook);
  act(() => result.current.initialize());
  await act(() => result.current.request());
  expect(result.current.pending?.wordSaved).toBe(true);
  expect(result.current.pending?.construction?.key).toBe("separable_verb");
});

it.each([useCreatedFlow, useDialogFlow])("preserves word confirmation and failure handling through %s", async (hook) => {
  vi.mocked(quickAddWordFromDialog).mockResolvedValue({ created: false, exists: false, source_text: "venir", target_text: "kommen", word_type: "verb" });
  const { result } = renderHook(hook);
  act(() => result.current.initialize());
  await act(() => result.current.request());
  expect(result.current.pending?.target).toBe("kommen");
  expect(quickAddWordFromDialog).toHaveBeenCalledOnce();
  vi.mocked(quickAddWordFromDialog).mockResolvedValue({ created: true, exists: false });
  await act(() => result.current.confirm());
  expect(quickAddWordFromDialog).toHaveBeenCalledTimes(2);
  expect(vi.mocked(quickAddWordFromDialog).mock.calls[1][6]).toBe(false);
  expect(result.current.status.word).toBe("added");
  expect(result.current.pending).toBeNull();
  vi.mocked(quickAddWordFromDialog).mockRejectedValue(new Error("Invalid resolution"));
  await act(() => result.current.request());
  expect(result.current.status.word).toBe("error");
  expect(result.current.pending).toBeNull();
});
