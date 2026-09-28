import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../src/i18n";
import { useConversationReviewErrorInfo } from "../src/features/conversation/useConversationReviewErrorInfo";
import { addConversationErrorExercises, requestConversationTurnErrorInfo } from "../src/apiConversationErrors";

vi.mock("../src/apiConversationErrors", () => ({
  addConversationErrorExercises: vi.fn(), requestConversationTurnErrorInfo: vi.fn(),
}));

const analysis = { errorText: "Put the verb second.", grammarFeatureKeys: ["verb_position_main_clause"], wordItemTargets: [] };
const args = { sourceLanguage: "spanish", targetLanguage: "german" } as const;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requestConversationTurnErrorInfo).mockResolvedValue(analysis);
  vi.mocked(addConversationErrorExercises).mockResolvedValue([42]);
});

describe("conversation correction and practice state", () => {
  it("does not request anything until asked, or add exercises before analysis", async () => {
    const { result } = renderHook(() => useConversationReviewErrorInfo(args));
    expect(result.current.byTurn).toEqual({});
    await act(async () => result.current.addExercises(0));
    expect(requestConversationTurnErrorInfo).not.toHaveBeenCalled();
    expect(addConversationErrorExercises).not.toHaveBeenCalled();
  });

  it("tracks pending analysis, prevents another request while loading, and keeps turns separate", async () => {
    const pending = deferred<typeof analysis>();
    vi.mocked(requestConversationTurnErrorInfo).mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() => useConversationReviewErrorInfo(args));
    let first!: Promise<void>;
    act(() => { first = result.current.requestErrorInfo(0, "original", "corrected"); });
    expect(result.current.byTurn[0]).toMatchObject({ loading: true, text: "", error: "" });
    await act(async () => result.current.requestErrorInfo(0, "original", "corrected"));
    expect(requestConversationTurnErrorInfo).toHaveBeenCalledTimes(1);
    await act(async () => result.current.requestErrorInfo(1, "other original", "other corrected"));
    expect(result.current.byTurn[0].loading).toBe(true);
    expect(result.current.byTurn[1].analysis).toEqual(analysis);
    await act(async () => { pending.resolve(analysis); await first; });
    expect(requestConversationTurnErrorInfo).toHaveBeenCalledWith("original", "corrected", "spanish", "german");
    expect(result.current.byTurn[0]).toMatchObject({ loading: false, text: analysis.errorText, analysis });
  });

  it("uses structured analysis when adding, guards pending/completed clicks, and does not call AI again", async () => {
    const pending = deferred<number[]>();
    vi.mocked(addConversationErrorExercises).mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() => useConversationReviewErrorInfo(args));
    await act(async () => result.current.requestErrorInfo(0, "original", "corrected"));
    let adding!: Promise<void>;
    act(() => { adding = result.current.addExercises(0); });
    expect(result.current.byTurn[0]).toMatchObject({ addingExercises: true, exercisesAdded: false });
    await act(async () => result.current.addExercises(0));
    expect(addConversationErrorExercises).toHaveBeenCalledTimes(1);
    await act(async () => { pending.resolve([42, 43]); await adding; });
    expect(result.current.byTurn[0]).toMatchObject({ addingExercises: false, exercisesAdded: true, analysis });
    await act(async () => result.current.addExercises(0));
    expect(addConversationErrorExercises).toHaveBeenCalledOnce();
    expect(addConversationErrorExercises).toHaveBeenCalledWith(analysis, "spanish", "german");
    expect(requestConversationTurnErrorInfo).toHaveBeenCalledOnce();
  });

  it.each(["en", "es"])("reports no matching exercises in %s and allows retry", async (language) => {
    localStorage.setItem("app_language", language);
    vi.mocked(addConversationErrorExercises).mockResolvedValueOnce([]);
    const { result } = renderHook(() => useConversationReviewErrorInfo(args), { wrapper: I18nProvider });
    await act(async () => result.current.requestErrorInfo(0, "original", "corrected"));
    await act(async () => result.current.addExercises(0));
    expect(result.current.byTurn[0]).toMatchObject({ addingExercises: false, exercisesAdded: false, analysis });
    expect(result.current.byTurn[0].error).toBe(language === "en"
      ? "No matching practice item was found" : "No se encontró ningún elemento de práctica adecuado");
    await act(async () => result.current.addExercises(0));
    expect(result.current.byTurn[0]).toMatchObject({ error: "", exercisesAdded: true });
    expect(requestConversationTurnErrorInfo).toHaveBeenCalledOnce();
  });

  it("keeps analysis on an add failure and clears the error on successful retry", async () => {
    vi.mocked(addConversationErrorExercises).mockRejectedValueOnce(new Error("Network unavailable"));
    const { result } = renderHook(() => useConversationReviewErrorInfo(args));
    await act(async () => result.current.requestErrorInfo(0, "original", "corrected"));
    await act(async () => result.current.addExercises(0));
    expect(result.current.byTurn[0]).toMatchObject({ analysis, text: analysis.errorText, error: "Network unavailable", exercisesAdded: false });
    await act(async () => result.current.addExercises(0));
    expect(result.current.byTurn[0]).toMatchObject({ error: "", exercisesAdded: true });
  });

  it("preserves a useful server error rather than replacing it with a generic failure", async () => {
    vi.mocked(requestConversationTurnErrorInfo).mockRejectedValueOnce(new Error("Weekly quota exhausted"));
    const { result } = renderHook(() => useConversationReviewErrorInfo(args));
    await act(async () => result.current.requestErrorInfo(0, "original", "corrected"));
    expect(result.current.byTurn[0]).toMatchObject({ loading: false, error: "Weekly quota exhausted", analysis: null });
    await act(async () => result.current.requestErrorInfo(0, "original", "corrected"));
    expect(result.current.byTurn[0]).toMatchObject({ loading: false, error: "", analysis });
  });

  it("retains the previous explanation during reanalysis and after a failure", async () => {
    const { result } = renderHook(() => useConversationReviewErrorInfo(args));
    await act(async () => result.current.requestErrorInfo(0, "original", "corrected"));
    const pending = deferred<typeof analysis>();
    vi.mocked(requestConversationTurnErrorInfo).mockReturnValueOnce(pending.promise);
    let retry!: Promise<void>;
    act(() => { retry = result.current.requestErrorInfo(0, "original", "corrected"); });
    expect(result.current.byTurn[0]).toMatchObject({ loading: true, text: analysis.errorText });
    await act(async () => { pending.reject(new Error("offline")); await retry; });
    expect(result.current.byTurn[0]).toMatchObject({ loading: false, text: analysis.errorText, error: "offline" });
  });
});
