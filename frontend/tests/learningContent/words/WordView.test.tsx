import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import WordView from "../../../src/features/learningContent/words/WordView";
import { isWordDefinition, type WordDefinition } from "../../../src/features/learningContent/words/definition";

const definition: WordDefinition = {
  key: "german_word_moeglichkeit", language: "german", item_view: "word",
  text: "die Möglichkeit", word_type: "noun", gender: "feminine",
  translations: { english: "the possibility", spanish: "la posibilidad" },
  display: {
    en: { title: "die Möglichkeit", explanation: "A possibility or an opportunity." },
    es: { title: "die Möglichkeit", explanation: "Una posibilidad o una oportunidad." },
  },
  strategies: [], exercises: [], evaluations: {},
};

it.each([
  ["en", "Type", "Word", "Noun", "Notes", "A possibility or an opportunity."],
  ["es", "Tipo", "Palabra", "Sustantivo", "Notas", "Una posibilidad o una oportunidad."],
] as const)("renders the word's supplied article, gender, translation and metadata in %s", (language, type, word, noun, notes, explanation) => {
  render(<WordView definition={definition} sourceLanguage="spanish" interfaceLanguage={language} />);
  const heading = screen.getByRole("heading", { name: "die Möglichkeit" });
  expect(heading).toHaveClass("item-view-title");
  expect(heading.closest(".item-view-header-card")).not.toBeNull();
  expect(heading.querySelector(".gender-word-mark.gender-word-feminine")).toHaveTextContent("die Möglichkeit");
  expect(screen.getByText("la posibilidad")).toHaveClass("item-view-subtitle");
  expect(screen.getByText(type)).toHaveClass("item-view-meta-label");
  expect(screen.getByText(word)).toHaveClass("item-view-meta-value");
  expect(screen.getByText(noun)).toHaveClass("item-view-type-description");
  expect(screen.getByText(notes)).toHaveClass("item-view-meta-label");
  expect(screen.getByText(explanation)).toHaveClass("item-view-meta-value-notes");
});

it("changes interface labels and translations independently", () => {
  const { rerender } = render(<WordView definition={definition} sourceLanguage="english" interfaceLanguage="en" />);
  rerender(<WordView definition={definition} sourceLanguage="english" interfaceLanguage="es" />);
  expect(screen.getByText("Palabra")).toBeInTheDocument();
  expect(screen.getByText("the possibility")).toBeInTheDocument();
  expect(screen.queryByText("la posibilidad")).not.toBeInTheDocument();
  rerender(<WordView definition={definition} sourceLanguage="spanish" interfaceLanguage="es" />);
  expect(screen.getByText("la posibilidad")).toBeInTheDocument();
  expect(screen.queryByText("the possibility")).not.toBeInTheDocument();
});

it("takes gender from the definition without inferring it from language or text", () => {
  const { rerender } = render(<WordView definition={{ ...definition, language: "another-language", gender: "masculine" }} sourceLanguage="english" />);
  expect(screen.getByRole("heading").querySelector(".gender-word-masculine")).toHaveTextContent("die Möglichkeit");
  rerender(<WordView definition={{ ...definition, gender: null }} sourceLanguage="english" />);
  expect(screen.getByRole("heading").querySelector(".gender-word-mark")).toBeNull();
  expect(screen.getByRole("heading")).toHaveTextContent("die Möglichkeit");
});

it("reports unavailable translations instead of substituting another language", () => {
  const { rerender } = render(<WordView definition={definition} sourceLanguage="french" />);
  expect(screen.getByRole("alert")).toHaveTextContent("This content is not available in your selected languages yet.");
  expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  rerender(<WordView definition={{ ...definition, display: { es: definition.display.es } }} sourceLanguage="spanish" interfaceLanguage="en" />);
  expect(screen.getByRole("alert")).toHaveTextContent("This content is not available in your selected languages yet.");
  expect(screen.queryByText("Una posibilidad o una oportunidad.")).not.toBeInTheDocument();
});

it.each(["verb", "toString", "__proto__"])("reports unsupported word type %s instead of showing an internal label", word_type => {
  render(<WordView definition={{ ...definition, word_type }} sourceLanguage="english" />);
  expect(screen.getByRole("alert")).toHaveTextContent("This item view is not available yet.");
  expect(screen.queryByRole("heading")).not.toBeInTheDocument();
});

it("recognizes a complete word definition, including absent optional translations and explicit no-gender", () => {
  expect(isWordDefinition(definition)).toBe(true);
  const untranslated: WordDefinition = { ...definition, translations: { english: undefined }, gender: null };
  expect(isWordDefinition(untranslated)).toBe(true);
});

it.each([
  { item_view: "phrase" }, { text: "" }, { text: 42 }, { word_type: "" },
  { gender: undefined }, { gender: "unknown" }, { translations: null },
  { translations: [] }, { translations: { spanish: 42 } },
])("rejects invalid word family data: %j", invalid => {
  expect(isWordDefinition({ ...definition, ...invalid })).toBe(false);
});
