import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { I18nProvider, useI18n } from "../../../src/i18n";
import ItemView from "../../../src/features/learningContent/itemViews/ItemView";
import type { AffixPatternDefinition } from "../../../src/features/learningContent/patterns/affix/definition";

const definition: AffixPatternDefinition = {
  key: "german_suffix_keit", language: "german", item_view: "affix_pattern",
  affix: "-keit", position: "suffix", word_types: ["noun"],
  strategies: [], exercises: [], evaluations: {},
  display: {
    en: { title: "-keit", explanation: "Names a quality or state." },
    es: { title: "-keit", explanation: "Expresa una cualidad o un estado." },
  },
  examples: [{
    base: "möglich", result: "die Möglichkeit",
    translations: {
      spanish: { base: "posible", result: "posibilidad" },
      english: { base: "possible", result: "possibility" },
    },
  }],
};

describe("definition-driven item views", () => {
  it("resolves the view and displays translated examples with the suffix highlighted", () => {
    render(<ItemView definition={definition} sourceLanguage="spanish" />);
    expect(screen.getByRole("heading", { name: "-keit" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "-keit" })).toHaveClass("item-view-title");
    expect(screen.getByRole("heading", { name: "-keit" }).closest(".item-view-header-card")).not.toBeNull();
    expect(screen.getByText("Names a quality or state.")).toHaveClass("item-view-meta-value-notes");
    expect(screen.getByText("Type")).toHaveClass("item-view-meta-label");
    expect(screen.getByText("Language pattern")).toHaveClass("item-view-meta-value");
    expect(screen.getByText("Word building")).toHaveClass("item-view-type-description");
    expect(screen.queryByText("Suffix")).not.toBeInTheDocument();
    expect(screen.getByText("Notes")).toHaveClass("item-view-meta-label");
    expect(screen.queryByText("Meaning")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Examples" })).toBeInTheDocument();
    const example = screen.getByRole("listitem");
    expect(example).toHaveTextContent("möglich → die Möglichkeit");
    expect(example.querySelectorAll("strong")).toHaveLength(1);
    expect(within(example).getByText("keit", { selector: "strong" })).toBeInTheDocument();
    expect(within(example).getByText("posible → posibilidad")).toBeInTheDocument();
    const actions = screen.getAllByRole("button");
    expect(actions).toHaveLength(5);
    for (const button of actions) expect(button).toBeDisabled();
  });

  it("switches interface language without changing the study translation", () => {
    function LanguageControl() {
      const { setLanguage } = useI18n();
      return <button onClick={() => setLanguage("es")}>Spanish UI</button>;
    }
    render(<I18nProvider><LanguageControl /><ItemView definition={definition} sourceLanguage="english" /></I18nProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Spanish UI" }));
    expect(screen.getByText("Expresa una cualidad o un estado.")).toBeInTheDocument();
    expect(screen.getByText("Tipo")).toBeInTheDocument();
    expect(screen.getByText("Patrón del idioma")).toBeInTheDocument();
    expect(screen.getByText("Formación de palabras")).toHaveClass("item-view-type-description");
    expect(screen.queryByText("Language pattern")).not.toBeInTheDocument();
    expect(screen.getByText("Notas")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ejemplos" })).toBeInTheDocument();
    expect(screen.getByText("possible → possibility")).toBeInTheDocument();
    expect(screen.queryByText("posible → posibilidad")).not.toBeInTheDocument();
  });

  it("updates when the item changes and handles prefixes without language-specific logic", () => {
    const { rerender } = render(<ItemView definition={definition} sourceLanguage="spanish" />);
    rerender(<ItemView definition={{
      ...definition, key: "english_prefix_un", language: "english", affix: "un-", position: "prefix",
      display: { en: { title: "un-", explanation: "Often adds an opposite meaning." } },
      examples: [{ base: "happy", result: "Unhappy", translations: { spanish: { base: "feliz", result: "infeliz" } } }],
    }} sourceLanguage="spanish" />);
    expect(screen.queryByRole("heading", { name: "-keit" })).not.toBeInTheDocument();
    expect(screen.getByText("Un", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText("Language pattern")).toBeInTheDocument();
    expect(screen.queryByText("Prefix")).not.toBeInTheDocument();
    expect(screen.queryByText("Suffix")).not.toBeInTheDocument();
    expect(screen.getByRole("listitem")).toHaveTextContent("happy → Unhappy");
  });

  it.each(["unknown", "toString", "__proto__"])("rejects an unregistered view: %s", item_view => {
    render(<ItemView definition={{ ...definition, item_view }} sourceLanguage="spanish" />);
    expect(screen.getByRole("alert")).toHaveTextContent("This item view is not available yet.");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("does not substitute another example translation", () => {
    render(<ItemView definition={definition} sourceLanguage="french" />);
    expect(screen.getByRole("alert")).toHaveTextContent("This content is not available in your selected languages yet.");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("does not substitute another explanation language", () => {
    render(<ItemView definition={{ ...definition, display: { es: definition.display.es } }} sourceLanguage="spanish" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("Expresa una cualidad o un estado.")).not.toBeInTheDocument();
  });

  it("shows only the first two examples, preserving order, translations and the full definition", () => {
    const examplesDefinition = { ...definition, examples: [
      ...definition.examples,
      { base: "sauber", result: "die Sauberkeit", translations: { spanish: { base: "limpio", result: "limpieza" } } },
      { base: "freundlich", result: "die Freundlichkeit", translations: { spanish: { base: "amable", result: "amabilidad" } } },
    ] };
    render(<ItemView definition={examplesDefinition} sourceLanguage="spanish" />);
    const examples = screen.getAllByRole("listitem");
    expect(examples).toHaveLength(2);
    expect(examples[0].children[0]).toHaveTextContent("möglich → die Möglichkeit");
    expect(examples[0].children[1]).toHaveTextContent("posible → posibilidad");
    expect(examples[1].children[0]).toHaveTextContent("sauber → die Sauberkeit");
    expect(examples[1].children[1]).toHaveTextContent("limpio → limpieza");
    expect(screen.queryByText("amable → amabilidad")).not.toBeInTheDocument();
    expect(examplesDefinition.examples).toHaveLength(3);
  });
});
