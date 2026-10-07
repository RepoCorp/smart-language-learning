import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import BankWords from "../../../src/features/learningContent/strategies/bankWords/BankWords";
import { fetchBankWords } from "../../../src/features/learningContent/strategies/bankWords/api";
import { keit } from "../fixtures";

const props = { definition: keit, strategyId: "affix_bank_words", sourceLanguage: "spanish" };
const word = { id: 1, text: "die Sauberkeit", translation: "la limpieza" };
const response = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status });
afterEach(() => vi.unstubAllGlobals());

it("loads real bank words read-only with the definition and language, not curated examples", async () => {
  const fetch = vi.fn().mockResolvedValue(response({ words: [word], next_offset: null }));
  vi.stubGlobal("fetch", fetch);
  render(<BankWords {...props} />);
  expect(screen.getByRole("status")).toHaveTextContent("Loading your words");
  expect(await screen.findByText(word.text)).toBeInTheDocument();
  expect(screen.getByText(word.translation)).toBeInTheDocument();
  expect(screen.queryByText("die Möglichkeit")).not.toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(1);
  const [url, options] = fetch.mock.calls[0];
  expect(url).toContain("/learning-content/german_suffix_keit/strategies/affix_bank_words/words?source_language=spanish&offset=0");
  expect(options.cache).toBe("no-store");
  expect(options.method ?? "GET").toBe("GET");
});

it.each(["en", "es"] as const)("shows an explicit empty state in %s", async interfaceLanguage => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ words: [], next_offset: null })));
  render(<BankWords {...props} interfaceLanguage={interfaceLanguage} />);
  expect(await screen.findByText(interfaceLanguage === "en"
    ? "You haven't saved any matching words in these languages yet."
    : "Todavía no has guardado palabras con este patrón en estos idiomas.")).toBeInTheDocument();
  expect(screen.queryByRole("list")).not.toBeInTheDocument();
});

it("keeps loaded words when the next page fails, and retries only that page", async () => {
  const fetch = vi.fn().mockResolvedValueOnce(response({ words: [word], next_offset: 20 }))
    .mockResolvedValueOnce(response({}, 503))
    .mockResolvedValueOnce(response({ words: [{ id: 2, text: "die Freundlichkeit", translation: "la amabilidad" }], next_offset: null }));
  vi.stubGlobal("fetch", fetch);
  render(<BankWords {...props} />);
  fireEvent.click(await screen.findByRole("button", { name: "Show more words" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Your words could not be loaded");
  expect(screen.getByText(word.text)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText("die Freundlichkeit")).toBeInTheDocument();
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
  expect(fetch.mock.calls.slice(1).every(([url]) => url.endsWith("offset=20"))).toBe(true);
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

it("cancels stale requests on language changes and does not reload for interface-language changes", async () => {
  let resolveOld!: (response: Response) => void;
  const fetch = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { resolveOld = resolve; }))
    .mockResolvedValueOnce(response({ words: [{ ...word, translation: "the cleanliness" }], next_offset: null }));
  vi.stubGlobal("fetch", fetch);
  const { rerender, unmount } = render(<BankWords {...props} />);
  rerender(<BankWords {...props} sourceLanguage="english" />);
  expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
  expect(await screen.findByText("the cleanliness")).toBeInTheDocument();
  await act(async () => resolveOld(response({ words: [word], next_offset: null })));
  expect(screen.queryByText("la limpieza")).not.toBeInTheDocument();
  rerender(<BankWords {...props} sourceLanguage="english" interfaceLanguage="es" />);
  expect(screen.getByRole("heading")).toHaveTextContent("Tus palabras");
  expect(fetch).toHaveBeenCalledTimes(2);
  unmount();
  expect(fetch.mock.calls[1][1].signal.aborted).toBe(true);
});

it("clears previous words immediately when the definition changes", async () => {
  const fetch = vi.fn().mockResolvedValueOnce(response({ words: [word], next_offset: null }))
    .mockImplementationOnce(() => new Promise(() => {}));
  vi.stubGlobal("fetch", fetch);
  const { rerender } = render(<BankWords {...props} />);
  await screen.findByText(word.text);
  rerender(<BankWords {...props} definition={{ ...keit, key: "another" }} />);
  expect(screen.queryByText(word.text)).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toBeInTheDocument();
});

it.each([{}, { words: [{}], next_offset: null }, { words: [], next_offset: 0 },
  { words: [], next_offset: "20" }, { words: [null], next_offset: null }])("rejects malformed responses %j", async body => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(body)));
  render(<BankWords {...props} />);
  expect(await screen.findByRole("alert")).toBeInTheDocument();
  expect(screen.queryByRole("list")).not.toBeInTheDocument();
});

it("surfaces network failure without substituting content", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  await expect(fetchBankWords(keit.key, props.strategyId, "spanish", 0, new AbortController().signal)).rejects.toThrow();
});
