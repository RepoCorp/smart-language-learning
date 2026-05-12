import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { vi } from "vitest";

import SessionPage from "../src/components/SessionPage";

vi.mock("../src/api", () => ({
  fetchContentItemDetail: vi.fn(),
  fetchSession: vi.fn(),
  markSeen: vi.fn().mockResolvedValue(undefined),
  setContentItemLearned: vi.fn().mockResolvedValue(undefined),
  submitReview: vi.fn().mockResolvedValue(undefined),
}));

import { fetchContentItemDetail, fetchSession, markSeen, submitReview } from "../src/api";

async function renderSessionPageAndStart(): Promise<void> {
  render(
    <BrowserRouter>
      <SessionPage />
    </BrowserRouter>
  );
  const durationInput = await screen.findByTestId("duration-minutes-input");
  await userEvent.clear(durationInput);
  await userEvent.type(durationInput, "10");
  await userEvent.click(screen.getByRole("button", { name: "Start session" }));
}

describe("SessionPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
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
        },
      ],
    });

    await renderSessionPageAndStart();

    expect(await screen.findByText("New word")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Got it" }));
    await waitFor(() => expect(markSeen).toHaveBeenCalledWith(1));
    expect(submitReview).not.toHaveBeenCalled();
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
      <BrowserRouter>
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
    await userEvent.click(screen.getByRole("button", { name: "Hint" }));
    expect(screen.getByText("Hint: d")).toBeInTheDocument();
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

    await userEvent.click(hintButton);
    expect(screen.getByText("Hint: d")).toBeInTheDocument();

    await userEvent.type(screen.getByTestId("word-input"), "d");
    await userEvent.click(hintButton);
    expect(screen.getByText("Hint: a")).toBeInTheDocument();
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
    await userEvent.click(screen.getByRole("button", { name: "Hint" }));

    expect(input).toHaveValue("d");
    expect(screen.getByText("Hint: a")).toBeInTheDocument();
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
    await userEvent.click(screen.getByRole("button", { name: "Hint" }));
    await userEvent.type(input, "d");
    await userEvent.click(screen.getByRole("button", { name: "Hint" }));
    await userEvent.type(input, "anke");

    expect(screen.getByText(/too many hints were used/i)).toBeInTheDocument();
    expect(submitReview).not.toHaveBeenCalled();
    const accept = screen.getByRole("button", { name: "Accept" });
    await waitFor(() => expect(accept).toBeEnabled());
    await userEvent.click(accept);
    await waitFor(() => expect(submitReview).toHaveBeenCalledWith(6, false, "es_to_de"));
  });

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
    await userEvent.click(screen.getByRole("button", { name: "Hint" }));
    expect(screen.getByText("Hint: e")).toBeInTheDocument();

    await userEvent.type(input, "e");
    await waitFor(() => expect(submitReview).toHaveBeenCalledWith(115, true, "es_to_de"));
    expect(screen.queryByText(/too many hints were used/i)).not.toBeInTheDocument();
  });

  it("supports keyboard shortcuts: Ctrl+Enter hints, Enter submits", async () => {
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
    expect(screen.getByText("Hint: a")).toBeInTheDocument();

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
    await userEvent.click(screen.getByRole("button", { name: "Check" }));

    expect(submitReview).not.toHaveBeenCalled();
    expect(screen.getByText("Please enter an answer.")).toBeInTheDocument();
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
    await userEvent.click(screen.getByRole("button", { name: "Hint" }));
    expect(input).toHaveValue("");

    await userEvent.click(screen.getByRole("button", { name: "Check" }));
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
    await userEvent.click(screen.getByRole("button", { name: "Hint" }));
    expect(screen.getByText("Hint: d")).toBeInTheDocument();

    await userEvent.type(screen.getByTestId("word-input"), "danke");
    await userEvent.click(screen.getByRole("button", { name: "Check" }));
    await waitFor(() => expect(submitReview).toHaveBeenCalledWith(10, true, "es_to_de"));

    await screen.findByText(/Item 2 of 2/);
    expect(screen.queryByText(/^Hint:/)).not.toBeInTheDocument();
  });

  it("supports german to spanish direction for word reviews", async () => {
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

    expect(await screen.findByText(/Select the correct Spanish translation: haus/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /casa/i }));
    await waitFor(() => expect(submitReview).toHaveBeenCalledWith(12, true, "de_to_es"));
  });

  it("allows marking word as wrong by choice in german to spanish direction", async () => {
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

    await screen.findByText(/Select the correct Spanish translation: haus/);
    await userEvent.click(screen.getByRole("button", { name: "I recognized it, mark wrong" }));
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
          direction: "es_to_de",
          options: [],
        },
      ],
    });

    await renderSessionPageAndStart();

    const input = await screen.findByTestId("word-input");
    await userEvent.type(input, "haus");
    await userEvent.click(screen.getByRole("button", { name: "Check" }));
    expect(submitReview).not.toHaveBeenCalled();
    const accept = screen.getByRole("button", { name: "Accept" });
    await waitFor(() => expect(accept).toBeEnabled());
    await userEvent.click(accept);
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
          direction: "es_to_de",
          options: [],
        },
      ],
    });

    await renderSessionPageAndStart();

    const input = await screen.findByTestId("word-input");
    await userEvent.type(input, "h");
    await userEvent.click(screen.getByRole("button", { name: "Hint" }));

    expect(input).toHaveValue("");
    expect(screen.getByText("Hint: H")).toBeInTheDocument();
  });

  it("supports german to spanish direction for phrase reviews", async () => {
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

    expect(await screen.findByText(/Select the correct Spanish translation: Ich verstehe nicht/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "No entiendo" }));
    await waitFor(() => expect(submitReview).toHaveBeenCalledWith(30, true, "de_to_es"));
  });

  it("supports number-key selection for phrase options", async () => {
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

    expect(await screen.findByRole("button", { name: "1. No entiendo" })).toBeInTheDocument();
    await userEvent.keyboard("1");
    await waitFor(() => expect(submitReview).toHaveBeenCalledWith(32, true, "de_to_es"));
  });

  it("opens a phrase option item in a closable modal without leaving the session", async () => {
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

    await screen.findByText(/Select the correct Spanish translation: Ich verstehe nicht/);
    await userEvent.click(screen.getByRole("button", { name: "Open item: Hola" }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("Hola")).toBeInTheDocument();
    expect(within(dialog).getByText("Hallo")).toBeInTheDocument();
    expect(screen.getByTestId("session-page")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByText(/Select the correct Spanish translation: Ich verstehe nicht/)).toBeInTheDocument();
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

    await screen.findByText(/Select the correct Spanish translation: Ich verstehe nicht/);
    await userEvent.click(screen.getByRole("button", { name: "I recognized it, mark wrong" }));
    expect(screen.getByText(/Marked as incorrect by choice/)).toBeInTheDocument();
    await waitFor(() => expect(submitReview).toHaveBeenCalledWith(31, false, "de_to_es"));
  });

  it("shows NewItem after incorrect answer and then moves to next test without showing original test", async () => {
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
    await userEvent.click(screen.getByRole("button", { name: "Check" }));
    expect(submitReview).not.toHaveBeenCalled();
    const accept = screen.getByRole("button", { name: "Accept" });
    await waitFor(() => expect(accept).toBeEnabled());
    await userEvent.click(accept);
    await waitFor(() => expect(submitReview).toHaveBeenCalledWith(40, false, "es_to_de"));

    expect(await screen.findByText("New word")).toBeInTheDocument();
    expect(screen.getByText("casa")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Got it" }));

    await screen.findByText(/Item 2 of 2/);
    expect(screen.queryByText("New word")).not.toBeInTheDocument();
    expect(screen.queryByText(/Write in German: casa/)).not.toBeInTheDocument();
    expect(await screen.findByText(/Write in German: perro/)).toBeInTheDocument();
  });

  it("accepts wrong-answer confirmation with Enter key", async () => {
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
    await userEvent.click(screen.getByRole("button", { name: "Check" }));
    const accept = await screen.findByRole("button", { name: "Accept" });
    await waitFor(() => expect(accept).toBeEnabled());

    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(submitReview).toHaveBeenCalledWith(42, false, "es_to_de"));
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
