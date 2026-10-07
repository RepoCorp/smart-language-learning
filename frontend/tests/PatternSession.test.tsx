import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SessionPage from "../src/components/SessionPage";
import { fetchSession, fetchSessionItem, submitReview } from "../src/api";
import { markSessionItemSeen } from "../src/apiSessionProgress";
import { toSessionPlanItems } from "../src/features/session/useSessionLifecycle";
import { ACTIVE_SESSION_CHANGED_EVENT } from "../src/features/session/sessionStorage";
import type { SessionPlanItem, SessionItem } from "../src/types";

vi.mock("../src/api", () => ({
  fetchSession: vi.fn(), fetchSessionItem: vi.fn(), fetchContentItemDetail: vi.fn(),
  submitReview: vi.fn().mockResolvedValue(undefined),
  completeDifficultItem: vi.fn(), restoreSessionItemState: vi.fn(),
}));
vi.mock("../src/components/useSessionStudyActivity", () => ({ default: vi.fn() }));
vi.mock("../src/apiSessionProgress", () => ({ markSessionItemSeen: vi.fn() }));
vi.mock("../src/components/session/SessionPageOverlays", () => ({ default: () => null }));
vi.mock("../src/components/WordReview", () => ({
  default: ({ item, reviewComplete, onAnswered, onNextItem }: {
    item: SessionItem; reviewComplete: boolean; onAnswered: (correct: boolean) => void; onNextItem: () => void;
  }) => <div><p>{item.german_text}</p>{reviewComplete
    ? <button onClick={onNextItem}>Next word</button>
    : <button onClick={() => onAnswered(true)}>Pass word</button>}</div>,
}));
vi.mock("../src/components/LegacyItemView", async () => ({ default: (await import("../src/components/session/PatternItem")).default }));
vi.mock("../src/components/PhraseReview", () => ({ default: () => null }));
vi.mock("../src/components/WordPartsReview", () => ({ default: () => null }));

const pattern: SessionPlanItem = {
  id: 8, item_type: "pattern", mode: "review", direction: "es_to_de", review_version: 0,
};
const patternPayload: SessionItem = {
  ...pattern, spanish_text: "Patrón", german_text: "-less", options: [],
  pattern_exercise: { base: "hope", base_translation: "esperanza", meaning: "sin esperanza", question: "¿Cómo dirías «sin esperanza»?", answer: "hopeless", highlight: [4, 8] },
};
const word: SessionItem = { id: 9, item_type: "word", mode: "review", direction: "es_to_de", spanish_text: "perro", german_text: "Hund", options: [] };
const storageKey = "active_session_spanish_german";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(submitReview).mockResolvedValue(undefined);
  vi.mocked(fetchSession).mockResolvedValue({ items: [pattern, word] });
  vi.mocked(fetchSessionItem).mockImplementation(async entry => entry.id === pattern.id ? patternPayload : word);
});

const definitionPayload: SessionItem = {
  ...patternPayload, pattern_key: "german_suffix_keit", german_text: "-keit",
  learning_evaluation: { id: "affix_production", content: {
    base: "möglich", base_translation: "posible", meaning: "posibilidad",
    answer: "die Möglichkeit", highlight: [11, 15],
  } },
};

describe("registered evaluations in real sessions", () => {
  beforeEach(() => {
    vi.mocked(fetchSessionItem).mockImplementation(async entry => entry.id === pattern.id ? definitionPayload : word);
  });

  it.each([true, false])("submits the pinned production version for result %s then advances the session", async correct => {
    render(<SessionPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Start session" }));
    expect(await screen.findByText("möglich")).toBeInTheDocument();
    expect(screen.queryByText("hope")).not.toBeInTheDocument();
    expect(screen.queryByText(/Möglichkeit/)).not.toBeInTheDocument();
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reveal answer" }));
    expect(screen.getByText("keit", { selector: "strong" }).parentElement).toHaveTextContent("die Möglichkeit");
    expect(screen.getByRole("note")).toHaveTextContent("-keit");
    fireEvent.click(screen.getByRole("button", { name: correct ? "Passed" : "Failed" }));
    const next = await screen.findByRole("button", { name: "Next" });
    expect(submitReview).toHaveBeenCalledTimes(1);
    expect(submitReview).toHaveBeenCalledWith(8, correct, "es_to_de", 0);
    expect(screen.getByRole("button", { name: "Open details" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Passed" })).not.toBeInTheDocument();
    fireEvent.click(next);
    expect(await screen.findByText("Hund")).toBeInTheDocument();
  });

  it("keeps the answer and allows retry after a save failure", async () => {
    vi.mocked(submitReview).mockRejectedValueOnce(new Error("Offline"));
    render(<SessionPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Start session" }));
    fireEvent.click(await screen.findByRole("button", { name: "Reveal answer" }));
    fireEvent.click(screen.getByRole("button", { name: "Passed" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Your result could not be saved.");
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
    expect(screen.getByText("keit", { selector: "strong" }).parentElement).toHaveTextContent("die Möglichkeit");
    fireEvent.click(screen.getByRole("button", { name: "Passed" }));
    expect(await screen.findByRole("button", { name: "Next" })).toBeInTheDocument();
    expect(submitReview).toHaveBeenCalledTimes(2);
    expect(submitReview).toHaveBeenLastCalledWith(8, true, "es_to_de", 0);
  });

  it.each([false, true])("restores a pinned attempt with completed=%s without scoring again", async completed => {
    sessionStorage.setItem(storageKey, JSON.stringify({
      items: [pattern, word], index: 0, sessionDurationMinutes: 10,
      sessionEndsAtMs: Date.now() + 600_000, showPostReviewItem: completed,
    }));
    render(<SessionPage />);
    expect(await screen.findByText("möglich")).toBeInTheDocument();
    expect(fetchSessionItem).toHaveBeenCalledWith(expect.objectContaining(pattern), "spanish", "german");
    expect(screen.getByRole("button", { name: completed ? "Next" : "Reveal answer" })).toBeInTheDocument();
    expect(submitReview).not.toHaveBeenCalled();
    expect(fetchSession).not.toHaveBeenCalled();
  });
});

async function start() {
  render(<SessionPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Start session" }));
  await screen.findByText("hope");
}

describe("patterns in regular sessions", () => {
  it("introduces a new pattern with curated examples through the shared seen endpoint", async () => {
    const newEntry: SessionPlanItem = { id: 8, item_type: "pattern", mode: "new", direction: null };
    vi.mocked(fetchSession).mockResolvedValue({ items: [newEntry] });
    vi.mocked(fetchSessionItem).mockResolvedValue({ ...patternPayload, ...newEntry,
      pattern_examples: [patternPayload.pattern_exercise!],
    });
    vi.mocked(markSessionItemSeen).mockResolvedValue({ new_items_completed_today: 1, show_new_items_celebration: false });
    render(<SessionPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Start session" }));
    const button = await screen.findByRole("button", { name: "Got it" });
    expect(screen.getByText(/esperanza → sin esperanza/)).toBeInTheDocument();
    fireEvent.click(button);
    await waitFor(() => expect(markSessionItemSeen).toHaveBeenCalledWith(8));
    expect(await screen.findByRole("button", { name: "Start another session" })).toBeInTheDocument();
    expect(submitReview).not.toHaveBeenCalled();
  });

  it("loads and rates patterns and words through the same session APIs", async () => {
    await start();
    fireEvent.click(screen.getByRole("button", { name: "Reveal answer" }));
    fireEvent.click(screen.getByRole("button", { name: "Passed" }));
    fireEvent.click(await screen.findByRole("button", { name: "Next" }));
    expect(await screen.findByText("Hund")).toBeInTheDocument();
    expect(submitReview).toHaveBeenCalledWith(8, true, "es_to_de", 0);
    expect(fetchSessionItem).toHaveBeenCalledWith(pattern, "spanish", "german");
    fireEvent.click(screen.getByRole("button", { name: "Pass word" }));
    fireEvent.click(await screen.findByRole("button", { name: "Next word" }));
    expect(submitReview).toHaveBeenCalledWith(9, true, "es_to_de");
    expect(await screen.findByRole("button", { name: "Start another session" })).toBeInTheDocument();
  });

  it("finishes a pattern-only session and permits starting again", async () => {
    vi.mocked(fetchSession).mockResolvedValue({ items: [pattern] });
    await start();
    fireEvent.click(screen.getByRole("button", { name: "Reveal answer" }));
    fireEvent.click(screen.getByRole("button", { name: "Failed" }));
    fireEvent.click(await screen.findByRole("button", { name: "Next" }));
    fireEvent.click(await screen.findByRole("button", { name: "Start another session" }));
    expect(await screen.findByRole("button", { name: "Start session" })).toBeInTheDocument();
    expect(submitReview).toHaveBeenCalledWith(8, false, "es_to_de", 0);
  });

  it("restores the reviewed pattern without posting another rating", async () => {
    sessionStorage.setItem(storageKey, JSON.stringify({
      items: [pattern, word], index: 0, sessionDurationMinutes: 10,
      sessionEndsAtMs: Date.now() + 600_000, showPostReviewItem: true,
    }));
    render(<SessionPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Next" }));
    expect(await screen.findByText("Hund")).toBeInTheDocument();
    expect(submitReview).not.toHaveBeenCalled();
    expect(fetchSession).not.toHaveBeenCalled();
  });

  it("preserves the exercise during the global extension prompt", async () => {
    await start();
    fireEvent.click(screen.getByRole("button", { name: "Reveal answer" }));
    await waitFor(() => expect(sessionStorage.getItem(storageKey)).not.toBeNull());
    const snapshot = JSON.parse(sessionStorage.getItem(storageKey)!);
    sessionStorage.setItem(storageKey, JSON.stringify({ ...snapshot, showExtendPrompt: true }));
    fireEvent(window, new CustomEvent(ACTIVE_SESSION_CHANGED_EVENT, { detail: { key: storageKey } }));
    expect(screen.getByRole("button", { name: "Passed" })).toBeDisabled();
    sessionStorage.setItem(storageKey, JSON.stringify({ ...snapshot, showExtendPrompt: false }));
    fireEvent(window, new CustomEvent(ACTIVE_SESSION_CHANGED_EVENT, { detail: { key: storageKey } }));
    expect(screen.getByRole("button", { name: "Passed" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Reveal answer" })).not.toBeInTheDocument();
  });

  it("restores lightweight entries but discards legacy pattern IDs", () => {
    expect(toSessionPlanItems([pattern, word])).toHaveLength(2);
    expect(toSessionPlanItems([pattern])[0].review_version).toBe(0);
    expect(toSessionPlanItems([{ ...pattern, exercise: patternPayload.pattern_exercise }, word])).toEqual([]);
  });
});
