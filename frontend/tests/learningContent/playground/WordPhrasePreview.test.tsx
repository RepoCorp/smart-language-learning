import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { I18nProvider } from "../../../src/i18n";
import LearningContentPlayground from "../../../src/features/learningContent/playground/LearningContentPlayground";
import ItemView from "../../../src/features/learningContent/itemViews/ItemView";
import { keit, phrase, word } from "../fixtures";

afterEach(() => vi.unstubAllGlobals());

it("switches between pattern, word and phrase previews without requests or progress writes", async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ definitions: [keit, word, phrase] }));
  vi.stubGlobal("fetch", fetch);
  localStorage.setItem("app_language", "en");
  render(<MemoryRouter><I18nProvider><LearningContentPlayground /></I18nProvider></MemoryRouter>);
  await screen.findByRole("heading", { name: "-keit" });
  const selector = screen.getByLabelText("Definition");
  expect(within(selector).getAllByRole("option").map(option => option.textContent)).toEqual([
    "-keit", word.text, phrase.text,
  ]);
  for (const definition of [word, phrase]) {
    fireEvent.change(selector, { target: { value: definition.key } });
    expect(screen.getByRole("heading", { name: definition.text })).toBeInTheDocument();
    expect(screen.getByText(definition.translations.spanish!)).toBeInTheDocument();
    const preview = within(screen.getByRole("region", { name: "Item view preview" }));
    if (definition === word) expect(preview.queryByText("Notes")).not.toBeInTheDocument();
    for (const button of preview.getAllByRole("button").slice(1)) expect(button).toBeDisabled();
    fireEvent.click(preview.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: "Open item view" }));
    expect(screen.getByRole("heading", { name: definition.text })).toBeInTheDocument();
  }
  fireEvent.change(screen.getByLabelText("Preview interface language"), { target: { value: "es" } });
  expect(screen.getByText("Frase")).toBeInTheDocument();
  expect(screen.getByText(phrase.translations.spanish!)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Translation language"), { target: { value: "english" } });
  expect(screen.getByText(phrase.translations.english!)).toBeInTheDocument();
  expect(localStorage.getItem("app_language")).toBe("en");
  expect(fetch).toHaveBeenCalledOnce();
});

it("reports an incompatible family payload instead of rendering affix content", () => {
  render(<ItemView definition={{ ...word, item_view: "affix_pattern" }} sourceLanguage="spanish" />);
  expect(screen.getByRole("alert")).toHaveTextContent("its definition is incomplete");
  expect(screen.queryByRole("heading")).not.toBeInTheDocument();
});

it("reports malformed catalog entries before mounting the preview", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ definitions: [null] })));
  localStorage.setItem("app_language", "en");
  render(<MemoryRouter><I18nProvider><LearningContentPlayground /></I18nProvider></MemoryRouter>);
  expect(await screen.findByRole("alert")).toHaveTextContent("unexpected response");
});
