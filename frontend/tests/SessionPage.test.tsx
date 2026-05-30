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
    const suggestions = within(screen.getByRole("group", { name: "Letter suggestions" })).getAllByRole("button");
    expect(suggestions).toHaveLength(3);
    expect(suggestions.map((button) => button.textContent)).toContain("d");

    await userEvent.click(screen.getByRole("button", { name: "d" }));
    expect(input).toHaveValue("d");
    expect(screen.queryByText(/Wrong letter/)).not.toBeInTheDocument();
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
    expect(screen.queryByText("Hint: a")).not.toBeInTheDocument();
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
    await userEvent.click(screen.getByRole("button", { name: "Hint" }));
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
    await userEvent.click(screen.getByRole("button", { name: "Hint" }));
    expect(screen.getByText("Hint: d")).toBeInTheDocument();

    await userEvent.type(screen.getByTestId("word-input"), "danke");
    await waitFor(() => expect(submitReview).toHaveBeenCalledWith(10, true, "es_to_de"));

    await screen.findByText(/Item 2 of 2/);
    expect(screen.queryByText(/^Hint:/)).not.toBeInTheDocument();
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

    expect(await screen.findByText(/What is the correct Spanish translation\? haus/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /casa/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open item" })).toBeInTheDocument();
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

    await screen.findByText(/What is the correct Spanish translation\? haus/);
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

    expect(await screen.findByText(/What is the correct Spanish translation\? Ich verstehe nicht/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "No entiendo" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open item" })).toBeInTheDocument();
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

    expect(await screen.findByText(/What is the correct Spanish translation\? Ich verstehe nicht/)).toBeInTheDocument();
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

    await screen.findByText(/What is the correct Spanish translation\? Ich verstehe nicht/);
    expect(screen.queryByRole("button", { name: "Open item: Hola" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open item" })).toBeInTheDocument();
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

    await screen.findByText(/Write in German: casa/);
    const actionButtons = screen.getAllByRole("button").map((button) => button.textContent);
    expect(actionButtons).toEqual(expect.arrayContaining(["Hint", "Open item", "Fail"]));
    expect(actionButtons.indexOf("Open item")).toBeLessThan(actionButtons.indexOf("Hint"));
    expect(actionButtons.indexOf("Open item")).toBeLessThan(actionButtons.indexOf("Fail"));
    await userEvent.click(screen.getByRole("button", { name: "Open item" }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("casa")).toBeInTheDocument();
    expect(within(dialog).getByText("Haus")).toBeInTheDocument();
    expect(fetchContentItemDetail).toHaveBeenCalledWith(36, "spanish", "german");
    expect(screen.getByTestId("session-page")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByText(/Write in German: casa/)).toBeInTheDocument();
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

    await screen.findByText(/What is the correct Spanish translation\? Ich verstehe nicht/);
    await userEvent.click(screen.getByRole("button", { name: "Reveal answer" }));
    const failedButton = screen.getByRole("button", { name: "Failed" });
    await userEvent.click(failedButton);
    await userEvent.click(failedButton);
    expect(screen.getByText(/Marked as incorrect by choice/)).toBeInTheDocument();
    await waitFor(() => expect(submitReview).toHaveBeenCalledWith(31, false, "de_to_es"));
  });

  it("shows NewItem after incorrect answer and presents the failed item again in the same session", async () => {
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

    expect(await screen.findByText("New word")).toBeInTheDocument();
    expect(screen.getByText("casa")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Got it" }));

    await screen.findByText(/Item 2 of 3/);
    expect(screen.queryByText("New word")).not.toBeInTheDocument();
    expect(screen.queryByText(/Write in German: casa/)).not.toBeInTheDocument();
    expect(await screen.findByText(/Write in German: perro/)).toBeInTheDocument();

    await userEvent.type(screen.getByTestId("word-input"), "Hund");
    await waitFor(() => expect(submitReview).toHaveBeenCalledWith(41, true, "es_to_de"));

    expect(await screen.findByText(/Item 3 of 3/)).toBeInTheDocument();
    expect(await screen.findByText(/Write in German: casa/)).toBeInTheDocument();
    await userEvent.type(screen.getByTestId("word-input"), "Haus");
    await waitFor(() => expect(submitReview).toHaveBeenCalledWith(40, false, "es_to_de"));
    expect(await screen.findByText("Session completed")).toBeInTheDocument();
  });

  it("does not repeat a failed item more than once in the same session", async () => {
    vi.mocked(fetchSession).mockResolvedValue({
      items: [
        {
          id: 43,
          mode: "review",
          item_type: "word",
          spanish_text: "mesa",
          german_text: "Tisch",
          direction: "es_to_de",
          options: [],
        },
      ],
    });

    await renderSessionPageAndStart();

    await screen.findByText(/Item 1 of 1/);
    const firstFailButton = screen.getByRole("button", { name: "Fail" });
    await userEvent.click(firstFailButton);
    await userEvent.click(firstFailButton);
    await waitFor(() => expect(submitReview).toHaveBeenCalledWith(43, false, "es_to_de"));

    await screen.findByText("New word");
    await userEvent.click(screen.getByRole("button", { name: "Got it" }));

    expect(await screen.findByText(/Item 2 of 2/)).toBeInTheDocument();
    expect(await screen.findByText(/Write in German: mesa/)).toBeInTheDocument();
    const secondFailButton = screen.getByRole("button", { name: "Fail" });
    await userEvent.click(secondFailButton);
    await userEvent.click(secondFailButton);
    await waitFor(() => expect(submitReview).toHaveBeenCalledTimes(2));

    await screen.findByText("New word");
    await userEvent.click(screen.getByRole("button", { name: "Got it" }));

    expect(await screen.findByText("Session completed")).toBeInTheDocument();
    expect(screen.queryByText(/Item 3 of 3/)).not.toBeInTheDocument();
  });

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
