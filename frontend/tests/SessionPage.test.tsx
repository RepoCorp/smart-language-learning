import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { vi } from "vitest";

import SessionPage from "../src/components/SessionPage";

const routerFutureFlags = {
  v7_relativeSplatPath: true,
  v7_startTransition: true,
};

vi.mock("../src/api", () => ({
  completeDifficultItem: vi.fn().mockResolvedValue(undefined),
  fetchContentItemDetail: vi.fn(),
  fetchOverviewStats: vi.fn().mockResolvedValue({ ready_to_review: 0, future_reviews: 0, word_items: 0, not_started: 0, difficult_items: 0 }),
  fetchSession: vi.fn(),
  markSeen: vi.fn().mockResolvedValue(undefined),
  restoreSessionItemState: vi.fn().mockResolvedValue(undefined),
  setContentItemLearned: vi.fn().mockResolvedValue(undefined),
  submitReview: vi.fn().mockResolvedValue(undefined),
}));

import { completeDifficultItem, fetchContentItemDetail, fetchOverviewStats, fetchSession, markSeen, restoreSessionItemState, submitReview } from "../src/api";

async function renderSessionPageAndStart(): Promise<void> {
  render(
    <BrowserRouter future={routerFutureFlags}>
      <SessionPage />
    </BrowserRouter>
  );
  const durationInput = await screen.findByTestId("duration-minutes-input");
  await userEvent.clear(durationInput);
  await userEvent.type(durationInput, "10");
  await userEvent.click(screen.getByRole("button", { name: "Start session" }));
}

function clickHintButton(): void {
  fireEvent.click(screen.getByRole("button", { name: "Hint" }));
}

describe("SessionPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    vi.mocked(fetchOverviewStats).mockResolvedValue({
      ready_to_review: 0,
      future_reviews: 0,
      word_items: 0,
      not_started: 0,
      difficult_items: 0,
    });
  });

  it("renders new item details", async () => {
    vi.mocked(fetchSession).mockResolvedValue({
      items: [
        {
          id: 1,
          mode: "new",
          item_type: "word",
          spanish_text: "hola",
          german_text: "hallo",
          example_sentence: "Hola!",
          notes: "saludo",
          audio_url: "https://example.com/a.mp3",
          options: [],
          session_restore_state: {
            repetition_count_es_to_de: 0,
            interval_days_es_to_de: 1,
            last_reviewed_at_es_to_de: null,
            due_at_es_to_de: null,
            repetition_count_de_to_es: 0,
            interval_days_de_to_es: 1,
            last_reviewed_at_de_to_es: null,
            due_at_de_to_es: null,
            is_learned: false,
            is_difficult: false,
            difficult_marked_at: null,
          },
        },
      ],
    });

    await renderSessionPageAndStart();

    expect(await screen.findByText("New word")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Got it" }));
    await waitFor(() => expect(markSeen).toHaveBeenCalledWith(1));
    expect(submitReview).not.toHaveBeenCalled();
  });

  it("opens the phrase builder test from a phrase item view", async () => {
    vi.mocked(fetchSession).mockResolvedValue({
      items: [
        {
          id: 49,
          mode: "new",
          item_type: "phrase",
          spanish_text: "Buenos días",
          german_text: "Guten Morgen",
          options: [],
        },
      ],
    });

    await renderSessionPageAndStart();

    expect(await screen.findByText("New phrase")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Open phrase builder" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Phrase builder")).toBeInTheDocument();
    expect(within(dialog).getByText("Build the German phrase for:")).toBeInTheDocument();
    expect(within(dialog).getByText("Buenos días")).toHaveClass("test-source-phrase");

    expect(within(dialog).getByRole("button", { name: "Guten" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Morgen" })).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("supports Enter key for Got it on NewItem", async () => {
    vi.mocked(fetchSession).mockResolvedValue({
      items: [
        {
          id: 9,
          mode: "new",
          item_type: "word",
          spanish_text: "hola",
          german_text: "hallo",
          options: [],
        },
      ],
    });

    await renderSessionPageAndStart();

    await screen.findByText("New word");
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(markSeen).toHaveBeenCalledWith(9));
  });

  it("restores active session state from sessionStorage without restarting", async () => {
    window.sessionStorage.setItem(
      "active_session_spanish_german",
      JSON.stringify({
        durationInput: "10",
        selectedSessionType: "standard",
        activeSessionType: "standard",
        sessionDurationMinutes: 10,
        sessionEndsAtMs: Date.now() + 5 * 60 * 1000,
        remainingSeconds: 300,
        sessionOutcome: null,
        index: 1,
        items: [
          {
            id: 21,
            mode: "review",
            item_type: "word",
            spanish_text: "hola",
            german_text: "hallo",
            direction: "es_to_de",
            options: [],
          },
          {
            id: 22,
            mode: "review",
            item_type: "word",
            spanish_text: "gracias",
            german_text: "danke",
            direction: "es_to_de",
            options: [],
          },
        ],
        showIncorrectReviewItem: false,
        showExtendPrompt: false,
      }),
    );

    render(
      <BrowserRouter future={routerFutureFlags}>
        <SessionPage />
      </BrowserRouter>
    );

    expect(await screen.findByText(/Item 2 of 2/)).toBeInTheDocument();
    expect(fetchSession).not.toHaveBeenCalled();
  });

  it("fetches content again after restarting the session", async () => {
    vi.mocked(fetchSession).mockResolvedValue({
      items: [
        {
          id: 41,
          mode: "new",
          item_type: "word",
          spanish_text: "hola",
          german_text: "hallo",
          options: [],
        },
      ],
    });

    await renderSessionPageAndStart();
    expect(await screen.findByText("New word")).toBeInTheDocument();
    expect(fetchSession).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole("button", { name: "Restart session" }));
    expect(await screen.findByTestId("session-start-form")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Start session" }));
    expect(await screen.findByText("New word")).toBeInTheDocument();
    expect(fetchSession).toHaveBeenCalledTimes(2);
  });

  it("goes back to the previous tested item and restores its original state before retesting", async () => {
    const firstRestoreState = {
      repetition_count_es_to_de: 2,
      interval_days_es_to_de: 4,
      last_reviewed_at_es_to_de: "2026-06-20T10:00:00Z",
      due_at_es_to_de: "2026-06-24T10:00:00Z",
      repetition_count_de_to_es: 0,
      interval_days_de_to_es: 1,
      last_reviewed_at_de_to_es: null,
      due_at_de_to_es: null,
      is_learned: false,
      is_difficult: false,
      difficult_marked_at: null,
    };
    vi.mocked(fetchSession).mockResolvedValue({
      items: [
        {
          id: 51,
          mode: "review",
          item_type: "word",
          spanish_text: "casa",
          german_text: "Haus",
          direction: "de_to_es",
          options: ["casa", "perro", "gato"],
          session_restore_state: firstRestoreState,
        },
        {
          id: 52,
          mode: "review",
          item_type: "word",
          spanish_text: "perro",
          german_text: "Hund",
          direction: "es_to_de",
          options: [],
        },
      ],
    });

    await renderSessionPageAndStart();

    await screen.findByText(/What is the correct Spanish translation\?/);
    await userEvent.click(screen.getByRole("button", { name: "Reveal answer" }));
    await userEvent.click(screen.getByRole("button", { name: "Passed" }));
    await waitFor(() => expect(submitReview).toHaveBeenCalledWith(51, true, "de_to_es"));

    await screen.findByText(/Item 2 of 2/);
    await userEvent.click(screen.getByRole("button", { name: "Previous tested item" }));

    await waitFor(() => expect(restoreSessionItemState).toHaveBeenCalledWith(51, firstRestoreState));
    expect(await screen.findByText(/Item 1 of 2/)).toBeInTheDocument();
    expect(screen.getByText("Haus")).toBeInTheDocument();
    const headerButtons = screen.getAllByRole("button", { name: /Open item|Restart session/ }).map((button) => button.textContent);
    expect(headerButtons.slice(0, 2)).toEqual(["Open item", "Restart session"]);
    expect(screen.queryByRole("button", { name: "Previous tested item" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Reveal answer" }));
    const failedButton = screen.getByRole("button", { name: "Failed" });
    await userEvent.click(failedButton);
    await userEvent.click(failedButton);
    await waitFor(() => expect(submitReview).toHaveBeenCalledWith(51, false, "de_to_es"));
  });

  it("allows hint in word review", async () => {
    vi.mocked(fetchSession).mockResolvedValue({
      items: [
        {
          id: 2,
          mode: "review",
          item_type: "word",
          spanish_text: "gracias",
          german_text: "danke",
          direction: "es_to_de",
          options: [],
        },
      ],
    });

    await renderSessionPageAndStart();

    expect(await screen.findByText(/Write in German/)).toBeInTheDocument();
    expect(screen.getByTestId("word-hint-count")).toHaveTextContent("Failures: 0");
    clickHintButton();
    expect(screen.getByTestId("word-hint-count")).toHaveTextContent("Failures: 1");
    const suggestions = within(screen.getByRole("group", { name: "Letter suggestions" })).getAllByRole("button");
    expect(suggestions).toHaveLength(3);
    expect(suggestions.map((button) => button.textContent)).toContain("d");
  });

  it("shows the next letter based on the current input", async () => {
    vi.mocked(fetchSession).mockResolvedValue({
      items: [
        {
          id: 3,
          mode: "review",
          item_type: "word",
          spanish_text: "gracias",
          german_text: "danke",
          direction: "es_to_de",
          options: [],
        },
      ],
    });

    await renderSessionPageAndStart();

    await screen.findByText(/Write in German/);
    const hintButton = screen.getByRole("button", { name: "Hint" });

    fireEvent.click(hintButton);
    expect(within(screen.getByRole("group", { name: "Letter suggestions" })).getAllByRole("button").map((button) => button.textContent)).toContain("d");

    await userEvent.type(screen.getByTestId("word-input"), "d");
    fireEvent.click(hintButton);
    expect(within(screen.getByRole("group", { name: "Letter suggestions" })).getAllByRole("button").map((button) => button.textContent)).toContain("a");
  });

  it("rejects incorrect letters in written word reviews", async () => {
    vi.mocked(fetchSession).mockResolvedValue({
      items: [
        {
          id: 44,
          mode: "review",
          item_type: "word",
          spanish_text: "gracias",
          german_text: "danke",
          direction: "es_to_de",
          options: [],
        },
      ],
    });

    await renderSessionPageAndStart();

    await screen.findByText(/Write in German/);
    const input = screen.getByTestId("word-input");
    await userEvent.type(input, "x");

    expect(input).toHaveValue("");
    expect(screen.getByText("Wrong letter: x")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Letter suggestions" })).not.toBeInTheDocument();

    clickHintButton();
    const suggestions = within(screen.getByRole("group", { name: "Letter suggestions" })).getAllByRole("button");
    expect(suggestions).toHaveLength(3);
    expect(suggestions.map((button) => button.textContent)).toContain("d");

    await userEvent.click(screen.getByRole("button", { name: "d" }));
    expect(input).toHaveValue("d");
    expect(screen.queryByText(/Wrong letter/)).not.toBeInTheDocument();
  });

  it("allows composed letters in written word reviews", async () => {
    vi.mocked(fetchSession).mockResolvedValue({
      items: [
        {
          id: 46,
          mode: "review",
          item_type: "word",
          spanish_text: "niña",
          german_text: "Mädchen",
          direction: "es_to_de",
          options: [],
        },
      ],
    });

    await renderSessionPageAndStart();

    await screen.findByText(/Write in German/);
    const input = screen.getByTestId("word-input");
    await userEvent.type(input, "M");

    fireEvent.change(input, { target: { value: "Ma" } });
    expect(input).toHaveValue("Ma");
    expect(screen.queryByText(/Wrong letter/)).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: "Mä" } });
    expect(input).toHaveValue("Mä");
    expect(screen.queryByText(/Wrong letter/)).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: "Mädchen" } });
    await waitFor(() => expect(submitReview).toHaveBeenCalledWith(46, true, "es_to_de"));
  });

  it("allows IME composition in written word reviews", async () => {
    vi.mocked(fetchSession).mockResolvedValue({
      items: [
        {
          id: 47,
          mode: "review",
          item_type: "word",
          spanish_text: "niña",
          german_text: "Mädchen",
          direction: "es_to_de",
          options: [],
        },
      ],
    });

    await renderSessionPageAndStart();

    await screen.findByText(/Write in German/);
    const input = screen.getByTestId("word-input");
    await userEvent.type(input, "M");

    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: "M¨" } });
    expect(input).toHaveValue("M¨");
    expect(screen.queryByText(/Wrong letter/)).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: "Mä" } });
    fireEvent.compositionEnd(input, { target: { value: "Mä" } });
    expect(input).toHaveValue("Mä");
    expect(screen.queryByText(/Wrong letter/)).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: "Mädchen" } });
    await waitFor(() => expect(submitReview).toHaveBeenCalledWith(47, true, "es_to_de"));
  });

  it("trims input from the first mistake before showing the next hint letter", async () => {
    vi.mocked(fetchSession).mockResolvedValue({
      items: [
        {
          id: 4,
          mode: "review",
          item_type: "word",
          spanish_text: "gracias",
          german_text: "danke",
          direction: "es_to_de",
          options: [],
        },
      ],
    });

    await renderSessionPageAndStart();

    await screen.findByText(/Write in German/);
    const input = screen.getByTestId("word-input");
    await userEvent.type(input, "dxn");
    clickHintButton();

    expect(input).toHaveValue("d");
    expect(within(screen.getByRole("group", { name: "Letter suggestions" })).getAllByRole("button").map((button) => button.textContent)).toContain("a");
  });

  it("waits for user accept before registering wrong when hints exceed 30 percent", async () => {
    vi.mocked(fetchSession).mockResolvedValue({
      items: [
        {
          id: 6,
          mode: "review",
          item_type: "word",
          spanish_text: "gracias",
          german_text: "danke",
          direction: "es_to_de",
          options: [],
        },
      ],
    });

    await renderSessionPageAndStart();

    const input = await screen.findByTestId("word-input");
    clickHintButton();
    await userEvent.type(input, "d");
    clickHintButton();
    await userEvent.type(input, "a");
    clickHintButton();
    await userEvent.type(input, "nke");

    expect(screen.getByText(/more than two hints or wrong letters were used/i)).toBeInTheDocument();
    expect(submitReview).not.toHaveBeenCalled();
    const accept = screen.getByRole("button", { name: "Accept" });
    await waitFor(() => expect(accept).toBeEnabled());
    await userEvent.click(accept);
    await waitFor(() => expect(submitReview).toHaveBeenCalledWith(6, false, "es_to_de"));
  }, 10000);

  it("auto-registers as correct when completed within hint limit", async () => {
    vi.mocked(fetchSession).mockResolvedValue({
      items: [
        {
          id: 15,
          mode: "review",
          item_type: "word",
          spanish_text: "gracias",
          german_text: "danke",
          direction: "es_to_de",
          options: [],
        },
      ],
    });

    await renderSessionPageAndStart();

    const input = await screen.findByTestId("word-input");
    await userEvent.type(input, "danke");
    await waitFor(() => expect(submitReview).toHaveBeenCalledWith(15, true, "es_to_de"));
  });

  it("does not mark wrong when only one hint is used after typing most letters", async () => {
    vi.mocked(fetchSession).mockResolvedValue({
      items: [
        {
          id: 115,
          mode: "review",
          item_type: "word",
          spanish_text: "gracias",
          german_text: "danke",
          direction: "es_to_de",
          options: [],
        },
      ],
    });

    await renderSessionPageAndStart();

    const input = await screen.findByTestId("word-input");
    await userEvent.type(input, "dank");
    clickHintButton();
    expect(within(screen.getByRole("group", { name: "Letter suggestions" })).getAllByRole("button").map((button) => button.textContent)).toContain("e");

    await userEvent.type(input, "e");
    await waitFor(() => expect(submitReview).toHaveBeenCalledWith(115, true, "es_to_de"));
    expect(screen.queryByText(/too many hints were used/i)).not.toBeInTheDocument();
  });

  it("counts repeated wrong attempts on the same letter only once", async () => {
    vi.mocked(fetchSession).mockResolvedValue({
      items: [
        {
          id: 116,
          mode: "review",
          item_type: "word",
          spanish_text: "gracias",
          german_text: "danke",
          direction: "es_to_de",
          options: [],
        },
      ],
    });

    await renderSessionPageAndStart();

    const input = await screen.findByTestId("word-input");
    await userEvent.type(input, "x");
    expect(screen.getByTestId("word-hint-count")).toHaveTextContent("Failures: 1");
    await userEvent.type(input, "x");
    expect(screen.getByTestId("word-hint-count")).toHaveTextContent("Failures: 1");
    clickHintButton();
    expect(screen.getByTestId("word-hint-count")).toHaveTextContent("Failures: 1");
    await userEvent.type(input, "danke");

    await waitFor(() => expect(submitReview).toHaveBeenCalledWith(116, true, "es_to_de"));
    expect(screen.queryByText(/more than two hints or wrong letters were used/i)).not.toBeInTheDocument();
  });

  it("does not submit or hint with Enter shortcuts", async () => {
    vi.mocked(fetchSession).mockResolvedValue({
      items: [
        {
          id: 5,
          mode: "review",
          item_type: "word",
          spanish_text: "gracias",
          german_text: "danke",
          direction: "es_to_de",
          options: [],
        },
      ],
    });

    await renderSessionPageAndStart();

    const input = await screen.findByTestId("word-input");
    await userEvent.type(input, "d");
    await userEvent.keyboard("{Control>}{Enter}{/Control}");
    expect(screen.queryByRole("group", { name: "Letter suggestions" })).not.toBeInTheDocument();
    expect(submitReview).not.toHaveBeenCalled();

    await userEvent.type(input, "anke");
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(submitReview).toHaveBeenCalledWith(5, true, "es_to_de"));
  });

  it("does not submit when answer is empty", async () => {
    vi.mocked(fetchSession).mockResolvedValue({
      items: [
        {
          id: 7,
          mode: "review",
          item_type: "word",
          spanish_text: "gracias",
          german_text: "danke",
          direction: "es_to_de",
          options: [],
        },
      ],
    });

    await renderSessionPageAndStart();

    await screen.findByTestId("word-input");
    await userEvent.keyboard("{Enter}");

    expect(submitReview).not.toHaveBeenCalled();
    expect(screen.queryByText("Please enter an answer.")).not.toBeInTheDocument();
  });

  it("does not show empty warning when input was cleared by hint", async () => {
    vi.mocked(fetchSession).mockResolvedValue({
      items: [
        {
          id: 8,
          mode: "review",
          item_type: "word",
          spanish_text: "gracias",
          german_text: "danke",
          direction: "es_to_de",
          options: [],
        },
      ],
    });

    await renderSessionPageAndStart();

    const input = await screen.findByTestId("word-input");
    await userEvent.type(input, "x");
    clickHintButton();
    expect(input).toHaveValue("");

    await userEvent.keyboard("{Enter}");
    expect(submitReview).not.toHaveBeenCalled();
    expect(screen.queryByText("Please enter an answer.")).not.toBeInTheDocument();
  });

  it("resets hint when moving to the next word", async () => {
    vi.mocked(fetchSession).mockResolvedValue({
      items: [
        {
          id: 10,
          mode: "review",
          item_type: "word",
          spanish_text: "gracias",
          german_text: "danke",
          direction: "es_to_de",
          options: [],
        },
        {
          id: 11,
          mode: "review",
          item_type: "word",
          spanish_text: "perro",
          german_text: "hund",
          direction: "es_to_de",
          options: [],
        },
      ],
    });

    await renderSessionPageAndStart();

    expect(await screen.findByText(/Write in German/)).toBeInTheDocument();
    clickHintButton();
    expect(within(screen.getByRole("group", { name: "Letter suggestions" })).getAllByRole("button").map((button) => button.textContent)).toContain("d");

    await userEvent.type(screen.getByTestId("word-input"), "danke");
    await waitFor(() => expect(submitReview).toHaveBeenCalledWith(10, true, "es_to_de"));

    await screen.findByText(/Item 2 of 2/);
    expect(screen.queryByRole("group", { name: "Letter suggestions" })).not.toBeInTheDocument();
  });

  it("supports self-graded german to spanish direction for word reviews", async () => {
    vi.mocked(fetchSession).mockResolvedValue({
      items: [
        {
          id: 12,
          mode: "review",
          item_type: "word",
          spanish_text: "casa",
          german_text: "haus",
          direction: "de_to_es",
          options: ["casa", "perro", "gato", "gracias"],
        },
      ],
    });

    await renderSessionPageAndStart();

    expect(await screen.findByText(/What is the correct Spanish translation\?/)).toBeInTheDocument();
    expect(screen.getByText("haus")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /casa/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reveal answer" }));
    expect(screen.getByText(/Answer:/)).toBeInTheDocument();
    expect(screen.getByText(/casa/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Passed" }));
    await waitFor(() => expect(submitReview).toHaveBeenCalledWith(12, true, "de_to_es"));
  });

  it("allows marking self-graded word reviews as failed", async () => {
    vi.mocked(fetchSession).mockResolvedValue({
      items: [
        {
          id: 112,
          mode: "review",
          item_type: "word",
          spanish_text: "casa",
          german_text: "haus",
          direction: "de_to_es",
          options: ["casa", "perro", "gato", "gracias"],
        },
      ],
    });

    await renderSessionPageAndStart();

    await screen.findByText(/What is the correct Spanish translation\?/);
    expect(screen.getByText("haus")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reveal answer" }));
    const failedButton = screen.getByRole("button", { name: "Failed" });
    await userEvent.click(failedButton);
    await userEvent.click(failedButton);
    expect(screen.getByText(/Marked as incorrect by choice/)).toBeInTheDocument();
    await waitFor(() => expect(submitReview).toHaveBeenCalledWith(112, false, "de_to_es"));
  });

  it("treats word answers as case-sensitive", async () => {
    vi.mocked(fetchSession).mockResolvedValue({
      items: [
        {
          id: 13,
          mode: "review",
          item_type: "word",
          spanish_text: "casa",
          german_text: "Haus",
          example_sentence: "Das Haus ist groß.",
          direction: "es_to_de",
          options: [],
        },
      ],
    });

    await renderSessionPageAndStart();

    const input = await screen.findByTestId("word-input");
    await userEvent.type(input, "haus");
    const failButton = screen.getByRole("button", { name: "Fail" });
    await userEvent.click(failButton);
    await userEvent.click(failButton);
    await waitFor(() => expect(submitReview).toHaveBeenCalledWith(13, false, "es_to_de"));
  });

  it("treats hint matching as case-sensitive", async () => {
    vi.mocked(fetchSession).mockResolvedValue({
      items: [
        {
          id: 14,
          mode: "review",
          item_type: "word",
          spanish_text: "casa",
          german_text: "Haus",
          exercise_phrases: {
            phrases: [
              {
                source_text: "La casa es grande.",
                target_text: "Das Haus ist groß.",
              },
            ],
          },
          direction: "es_to_de",
          options: [],
        },
      ],
    });

    await renderSessionPageAndStart();

    const input = await screen.findByTestId("word-input");
    await userEvent.type(input, "h");
    clickHintButton();

    expect(input).toHaveValue("");
    expect(within(screen.getByRole("group", { name: "Letter suggestions" })).getAllByRole("button").map((button) => button.textContent)).toContain("H");
  });

  it("supports self-graded german to spanish direction for phrase reviews", async () => {
    vi.mocked(fetchSession).mockResolvedValue({
      items: [
        {
          id: 30,
          mode: "review",
          item_type: "phrase",
          spanish_text: "No entiendo",
          german_text: "Ich verstehe nicht",
          direction: "de_to_es",
          options: ["No entiendo", "Hola", "Gracias", "Adios"],
        },
      ],
    });

    await renderSessionPageAndStart();

    expect(await screen.findByText(/What is the correct Spanish translation\?/)).toBeInTheDocument();
    expect(screen.getByText("Ich verstehe nicht")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "No entiendo" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reveal answer" }));
    expect(screen.getByText(/Answer:/)).toBeInTheDocument();
    expect(screen.getByText(/No entiendo/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Passed" }));
    await waitFor(() => expect(submitReview).toHaveBeenCalledWith(30, true, "de_to_es"));
  });

  it("does not submit phrase reviews with number keys before the answer is revealed", async () => {
    vi.mocked(fetchSession).mockResolvedValue({
      items: [
        {
          id: 32,
          mode: "review",
          item_type: "phrase",
          spanish_text: "No entiendo",
          german_text: "Ich verstehe nicht",
          direction: "de_to_es",
          options: ["No entiendo", "Hola", "Gracias", "Adios"],
        },
      ],
    });

    await renderSessionPageAndStart();

    expect(await screen.findByText(/What is the correct Spanish translation\?/)).toBeInTheDocument();
    expect(screen.getByText("Ich verstehe nicht")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "1. No entiendo" })).not.toBeInTheDocument();
    await userEvent.keyboard("1");
    expect(submitReview).not.toHaveBeenCalled();
  });

  it("does not show phrase option item buttons in self-graded reviews", async () => {
    vi.mocked(fetchSession).mockResolvedValue({
      items: [
        {
          id: 32,
          mode: "review",
          item_type: "phrase",
          spanish_text: "No entiendo",
          german_text: "Ich verstehe nicht",
          direction: "de_to_es",
          options: ["No entiendo", "Hola", "Gracias", "Adios"],
          option_items: [
            { id: 32, text: "No entiendo" },
            { id: 33, text: "Hola" },
            { id: 34, text: "Gracias" },
            { id: 35, text: "Adios" },
          ],
        },
      ],
    });
    vi.mocked(fetchContentItemDetail).mockResolvedValue({
      id: 33,
      item_type: "phrase",
      spanish_text: "Hola",
      german_text: "Hallo",
      created_at: "2026-05-08T10:00:00Z",
    });

    await renderSessionPageAndStart();

    await screen.findByText(/What is the correct Spanish translation\?/);
    expect(screen.getByText("Ich verstehe nicht")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open item: Hola" })).not.toBeInTheDocument();
    expect(screen.getByTestId("session-page")).toBeInTheDocument();
    expect(submitReview).not.toHaveBeenCalled();
  });

  it("opens the current review item in a closable modal from a written test", async () => {
    vi.mocked(fetchSession).mockResolvedValue({
      items: [
        {
          id: 36,
          mode: "review",
          item_type: "word",
          spanish_text: "casa",
          german_text: "Haus",
          direction: "es_to_de",
          options: [],
          related_dialogs: [
            {
              dialog_id: 1,
              topic: "home",
              context: "",
              audio_url: "",
              created_at: "2026-01-01T00:00:00Z",
              turns: [
                {
                  source_text: "Mi casa es pequeña.",
                  target_text: "Mein Haus ist klein.",
                },
              ],
              matched_turns: [
                {
                  turn_index: 0,
                  side: "target",
                  match_score: 1,
                  source_text: "Mi casa es pequeña.",
                  target_text: "Mein Haus ist klein.",
                },
              ],
            },
          ],
        },
      ],
    });
    vi.mocked(fetchContentItemDetail).mockResolvedValue({
      id: 36,
      item_type: "word",
      spanish_text: "casa",
      german_text: "Haus",
      created_at: "2026-05-08T10:00:00Z",
    });

    await renderSessionPageAndStart();

    await screen.findByText(/Write in German/);
    expect(screen.getByText("casa")).toBeInTheDocument();
    const headerButtons = screen.getAllByRole("button", { name: /Open item|Restart session/ }).map((button) => button.textContent);
    expect(headerButtons.slice(0, 2)).toEqual(["Open item", "Restart session"]);
    const actionButtons = screen.getAllByRole("button").map((button) => button.textContent);
    expect(actionButtons).toEqual(expect.arrayContaining(["Hint", "Fail"]));
    await userEvent.click(screen.getAllByRole("button", { name: "Open item" })[0]);

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("casa")).toBeInTheDocument();
    expect(within(dialog).getByText("Haus")).toBeInTheDocument();
    expect(fetchContentItemDetail).toHaveBeenCalledWith(36, "spanish", "german");
    expect(screen.getByTestId("session-page")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByText(/Write in German/)).toBeInTheDocument();
    expect(screen.getByText("casa")).toBeInTheDocument();
    expect(submitReview).not.toHaveBeenCalled();
  });

  it("allows marking phrase as wrong by choice", async () => {
    vi.mocked(fetchSession).mockResolvedValue({
      items: [
        {
          id: 31,
          mode: "review",
          item_type: "phrase",
          spanish_text: "No entiendo",
          german_text: "Ich verstehe nicht",
          direction: "de_to_es",
          options: ["No entiendo", "Hola", "Gracias", "Adios"],
        },
      ],
    });

    await renderSessionPageAndStart();

    await screen.findByText(/What is the correct Spanish translation\?/);
    expect(screen.getByText("Ich verstehe nicht")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reveal answer" }));
    const failedButton = screen.getByRole("button", { name: "Failed" });
    await userEvent.click(failedButton);
    await userEvent.click(failedButton);
    expect(screen.getByText(/Marked as incorrect by choice/)).toBeInTheDocument();
    await waitFor(() => expect(submitReview).toHaveBeenCalledWith(31, false, "de_to_es"));
  });

  it("adds failed phrase reviews to the difficult queue instead of retrying them in the same session", async () => {
    vi.mocked(fetchSession).mockResolvedValue({
      items: [
        {
          id: 48,
          mode: "review",
          item_type: "phrase",
          spanish_text: "No entiendo",
          german_text: "Ich verstehe nicht",
          direction: "de_to_es",
          options: ["No entiendo", "Hola", "Gracias"],
        },
      ],
    });

    await renderSessionPageAndStart();

    await screen.findByText(/What is the correct Spanish translation\?/);
    expect(screen.getByText("Ich verstehe nicht")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reveal answer" }));
    const failedButton = screen.getByRole("button", { name: "Failed" });
    await userEvent.click(failedButton);
    await userEvent.click(failedButton);
    await waitFor(() => expect(submitReview).toHaveBeenCalledWith(48, false, "de_to_es"));
    expect(await screen.findByText("Session completed")).toBeInTheDocument();
  });

  it("keeps the original regular session sequence after an incorrect answer", async () => {
    vi.mocked(fetchSession).mockResolvedValue({
      items: [
        {
          id: 40,
          mode: "review",
          item_type: "word",
          spanish_text: "casa",
          german_text: "Haus",
          direction: "es_to_de",
          options: [],
        },
        {
          id: 41,
          mode: "review",
          item_type: "word",
          spanish_text: "perro",
          german_text: "Hund",
          direction: "es_to_de",
          options: [],
        },
      ],
    });

    await renderSessionPageAndStart();

    const input = await screen.findByTestId("word-input");
    await userEvent.type(input, "haus");
    const failButton = screen.getByRole("button", { name: "Fail" });
    await userEvent.click(failButton);
    await userEvent.click(failButton);
    await waitFor(() => expect(submitReview).toHaveBeenCalledWith(40, false, "es_to_de"));

    await screen.findByText(/Item 2 of 2/);
    expect(await screen.findByText(/Write in German/)).toBeInTheDocument();
    expect(screen.getByText("perro")).toBeInTheDocument();

    await userEvent.type(screen.getByTestId("word-input"), "Hund");
    await waitFor(() => expect(submitReview).toHaveBeenCalledWith(41, true, "es_to_de"));
    expect(await screen.findByText("Session completed")).toBeInTheDocument();
  });

  it("runs difficult practice inside the regular session without submitting new review results", async () => {
    vi.mocked(fetchOverviewStats).mockResolvedValue({
      ready_to_review: 0,
      future_reviews: 0,
      word_items: 0,
      not_started: 0,
      difficult_items: 1,
    });
    vi.mocked(fetchSession).mockResolvedValue({
      items: [
        {
          id: 43,
          mode: "review",
          item_type: "word",
          spanish_text: "mesa",
          german_text: "Tisch",
          exercise_phrases: {
            phrases: [
              {
                source_text: "La mesa está lista.",
                target_text: "Der Tisch ist bereit.",
              },
            ],
          },
          direction: "es_to_de",
          repeatedAfterFailure: true,
          repeatPracticeStep: "word_intro",
          options: [],
        },
        {
          id: 43,
          mode: "review",
          item_type: "word",
          spanish_text: "mesa",
          german_text: "Tisch",
          exercise_phrases: {
            phrases: [
              {
                source_text: "La mesa está lista.",
                target_text: "Der Tisch ist bereit.",
              },
            ],
          },
          direction: "es_to_de",
          repeatedAfterFailure: true,
          repeatPracticeStep: "word_cloze",
          options: [],
        },
      ],
    });

    await renderSessionPageAndStart();

    expect(await screen.findByText(/Item 1 of 2/)).toBeInTheDocument();
    await userEvent.type(screen.getByTestId("word-input"), "Tisch");

    expect(await screen.findByText(/Item 2 of 2/)).toBeInTheDocument();
    expect(await screen.findByText(/Complete the phrase with:/)).toBeInTheDocument();
    expect(screen.getByText("mesa")).toBeInTheDocument();
    expect(screen.getByText("_____")).toBeInTheDocument();
    expect(screen.queryByTestId("word-input")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "T" }));
    await userEvent.click(screen.getByRole("button", { name: "i" }));
    await userEvent.click(screen.getByRole("button", { name: "s" }));
    await userEvent.click(screen.getByRole("button", { name: "c" }));
    await userEvent.click(screen.getByRole("button", { name: "h" }));
    await waitFor(() => expect(completeDifficultItem).toHaveBeenCalledWith(43));
    expect(submitReview).not.toHaveBeenCalled();
    expect(await screen.findByText("Session completed")).toBeInTheDocument();
  }, 10000);

  it("does not submit a written answer when Enter is pressed", async () => {
    vi.mocked(fetchSession).mockResolvedValue({
      items: [
        {
          id: 42,
          mode: "review",
          item_type: "word",
          spanish_text: "casa",
          german_text: "Haus",
          direction: "es_to_de",
          options: [],
        },
      ],
    });

    await renderSessionPageAndStart();

    const input = await screen.findByTestId("word-input");
    await userEvent.type(input, "haus");
    await userEvent.keyboard("{Enter}");
    expect(submitReview).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument();
  });

  it("ends the session when selected items are completed", async () => {
    vi.mocked(fetchSession)
      .mockResolvedValueOnce({
        items: [
          {
            id: 21,
            mode: "new",
            item_type: "word",
            spanish_text: "hola",
            german_text: "hallo",
            options: [],
          },
        ],
      });

    await renderSessionPageAndStart();

    expect(await screen.findByText("hola")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Got it" }));

    await waitFor(() => expect(fetchSession).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Session completed")).toBeInTheDocument();
  });
});
