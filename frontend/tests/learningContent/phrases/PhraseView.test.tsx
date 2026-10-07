import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import PhraseView from "../../../src/features/learningContent/phrases/PhraseView";
import { isPhraseDefinition, type PhraseDefinition } from "../../../src/features/learningContent/phrases/definition";

const definition: PhraseDefinition = {
  key: "german_phrase_repeat_request", language: "german", item_view: "phrase",
  text: "Könnten Sie das bitte wiederholen?",
  translations: {
    english: "Could you please repeat that?",
    spanish: "¿Podría repetir eso, por favor?",
  },
  display: {
    en: { title: "Könnten Sie das bitte wiederholen?", explanation: "A polite request to hear something again." },
    es: { title: "Könnten Sie das bitte wiederholen?", explanation: "Una petición cortés para volver a escuchar algo." },
  },
  strategies: [], exercises: [], evaluations: {},
};

it.each([
  ["en", "Type", "Phrase", "Notes", "A polite request to hear something again."],
  ["es", "Tipo", "Frase", "Notas", "Una petición cortés para volver a escuchar algo."],
] as const)("renders the complete phrase, translation and metadata in %s", (language, type, phrase, notes, explanation) => {
  render(<PhraseView definition={definition} sourceLanguage="spanish" interfaceLanguage={language} />);
  const heading = screen.getByRole("heading", { name: definition.text });
  expect(heading).toHaveClass("item-view-title");
  expect(heading.closest(".item-view-header-card")).not.toBeNull();
  expect(screen.getByText("¿Podría repetir eso, por favor?")).toHaveClass("item-view-subtitle");
  expect(screen.getByText(type)).toHaveClass("item-view-meta-label");
  expect(screen.getByText(phrase)).toHaveClass("item-view-meta-value");
  expect(screen.getByText(notes)).toHaveClass("item-view-meta-label");
  expect(screen.getByText(explanation)).toHaveClass("item-view-meta-value-notes");
});

it("changes interface labels and translations independently", () => {
  const { rerender } = render(<PhraseView definition={definition} sourceLanguage="english" interfaceLanguage="en" />);
  rerender(<PhraseView definition={definition} sourceLanguage="english" interfaceLanguage="es" />);
  expect(screen.getByText("Frase")).toBeInTheDocument();
  expect(screen.getByText("Could you please repeat that?")).toBeInTheDocument();
  expect(screen.queryByText("¿Podría repetir eso, por favor?")).not.toBeInTheDocument();
  rerender(<PhraseView definition={definition} sourceLanguage="spanish" interfaceLanguage="es" />);
  expect(screen.getByText("¿Podría repetir eso, por favor?")).toBeInTheDocument();
  expect(screen.queryByText("Could you please repeat that?")).not.toBeInTheDocument();
});

it("reports unavailable translations instead of substituting another language", () => {
  const { rerender } = render(<PhraseView definition={definition} sourceLanguage="french" interfaceLanguage="es" />);
  expect(screen.getByRole("alert")).toHaveTextContent("Este contenido aún no está disponible en tus idiomas seleccionados.");
  expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  rerender(<PhraseView definition={{ ...definition, display: { en: definition.display.en } }} sourceLanguage="english" interfaceLanguage="es" />);
  expect(screen.getByRole("alert")).toHaveTextContent("Este contenido aún no está disponible en tus idiomas seleccionados.");
  expect(screen.queryByText("A polite request to hear something again.")).not.toBeInTheDocument();
});

it("recognizes a complete phrase definition, including absent optional translations", () => {
  expect(isPhraseDefinition(definition)).toBe(true);
  const untranslated: PhraseDefinition = { ...definition, translations: { english: undefined } };
  expect(isPhraseDefinition(untranslated)).toBe(true);
});

it.each([
  { item_view: "word" }, { text: "" }, { text: 42 },
  { translations: null }, { translations: [] }, { translations: { spanish: 42 } },
])("rejects invalid phrase family data: %j", invalid => {
  expect(isPhraseDefinition({ ...definition, ...invalid })).toBe(false);
});
