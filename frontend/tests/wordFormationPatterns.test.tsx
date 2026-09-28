import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../src/i18n";
import { matchWordFormationPatterns } from "../src/languageFeatures/wordFormation";
import WordFormationPatterns from "../src/components/strategies/WordFormationPatterns";
import { germanWordFormation } from "../src/languageFeatures/german/wordFormation";

vi.mock("../src/components/strategies/PatternEnrollment", () => ({ default: () => null }));

function ids(text: string, wordType = "adjective", language = "german") {
  return matchWordFormationPatterns(text, wordType, language).map(match => match.pattern.id);
}

describe("local word formation matching", () => {
  it("contains exactly the ten agreed affixes, each with a matching canonical example", () => {
    expect(germanWordFormation.patterns.map(pattern => pattern.label)).toEqual([
      "un-", "-los", "-bar", "-lich", "-heit", "-keit", "-ung", "-er", "-in", "-chen",
    ]);
    for (const pattern of germanWordFormation.patterns) {
      expect(pattern.expression.global).toBe(false);
      expect(pattern.expression.sticky).toBe(false);
      expect(ids(pattern.example.word, pattern.wordTypes[0])).toContain(pattern.id);
    }
  });
  it.each([
    ["arbeitslos", "adjective", ["german_suffix_los"]],
    ["lesbar", "adjective", ["german_suffix_bar"]],
    ["die Möglichkeit", "noun", ["german_suffix_keit"]],
    ["Freiheit", "noun", ["german_suffix_heit"]],
    ["freundlich", "adjective", ["german_suffix_lich"]],
    ["die Entwicklung", "noun", ["german_suffix_ung"]],
    ["der Lehrer", "noun", ["german_suffix_er"]],
    ["die Lehrerin", "noun", ["german_suffix_in"]],
    ["das Hündchen", "noun", ["german_suffix_chen"]],
    ["unlesbar", "adjective", ["german_prefix_un", "german_suffix_bar"]],
    ["  DIE UNMÖGLICHKEIT  ", " Noun ", ["german_prefix_un", "german_suffix_keit"]],
  ])("matches %s deterministically", (text, type, expected) => {
    for (let attempt = 0; attempt < 3; attempt += 1) expect(ids(text, type)).toEqual(expected);
  });

  it.each([
    ["bar", "adjective"], ["los", "adjective"], ["un", "adjective"],
    ["wunderbar", "noun"], ["Bar", "noun"], ["Hund", "noun"],
    ["losgehen", "verb"], ["barfuß", "adjective"], ["gesund", "adjective"],
    ["nicht lesbar", "adjective"], ["das ist hoffnungslos", "adjective"],
    ["", "noun"], ["die", "noun"],
  ])("does not match %s (%s)", (text, type) => {
    expect(ids(text, type)).toEqual([]);
  });

  it("does not apply German patterns to other languages", () => {
    expect(ids("lesbar", "adjective", "english")).toEqual([]);
    expect(ids("unlesbar", "adjective", "spanish")).toEqual([]);
    expect(ids("unlesbar", "adjective", "unknown")).toEqual([]);
  });

  it("returns exact highlight positions while retaining capitalization", () => {
    const matches = matchWordFormationPatterns("  die Unmöglichkeit ", "noun", "german");
    expect(matches.map(({ word, start, end }) => [word, word.slice(start, end)])).toEqual([
      ["Unmöglichkeit", "Un"], ["Unmöglichkeit", "keit"],
    ]);
  });

  it("normalizes decomposed accents and does not search inside compound words", () => {
    expect(ids("die Mo\u0308glichkeit", "noun")).toEqual(["german_suffix_keit"]);
    expect(ids("Arbeitslosigkeit", "noun")).toEqual(["german_suffix_keit"]);
    expect(ids("Freiheitsgefühl", "noun")).toEqual([]);
  });
});

describe("word formation cards", () => {
  it.each(["en", "es"] as const)("shows localized explanations and highlighted study text in %s", language => {
    localStorage.setItem("app_language", language);
    const { container } = render(<I18nProvider><WordFormationPatterns targetText="die Möglichkeit" wordType="noun" targetLanguage="german" /></I18nProvider>);
    expect(screen.getByRole("heading", { name: language === "en" ? "Word building" : "Cómo se forman las palabras" })).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "-keit" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 4 })).not.toBeInTheDocument();
    expect(container.querySelector(".word-formation-match")).toBeNull();
    expect(container.querySelector(".word-formation-patterns > .hint")).toBeNull();
    expect(container.querySelector(".word-formation-card > p:first-child strong")).toHaveTextContent("-keit");
    expect(container.querySelector(".grammar-phrase-feature-example")).toHaveTextContent("möglich → Möglichkeit");
    expect(container.querySelector(".grammar-phrase-feature-example strong")).toHaveTextContent("keit");
    expect(screen.getByText(language === "en" ? /quality or state/ : /cualidad o un estado/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("updates matches when the word changes and renders nothing for unsupported words", () => {
    const { rerender, container } = render(<WordFormationPatterns targetText="lesbar" wordType="adjective" targetLanguage="german" />);
    expect(screen.getByRole("article", { name: "-bar" })).toBeInTheDocument();
    rerender(<WordFormationPatterns targetText="arbeitslos" wordType="adjective" targetLanguage="german" />);
    expect(screen.getByRole("article", { name: "-los" })).toBeInTheDocument();
    expect(screen.queryByRole("article", { name: "-bar" })).not.toBeInTheDocument();
    rerender(<WordFormationPatterns targetText="Hund" wordType="noun" targetLanguage="german" />);
    expect(container).toBeEmptyDOMElement();
  });
});
