import { render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider, useI18n } from "../src/i18n";
import { matchWordFormationPatterns } from "../src/languageFeatures/wordFormation";
import WordFormationPatterns from "../src/components/strategies/WordFormationPatterns";
import { englishWordFormation } from "../src/languageFeatures/english/wordFormation";

vi.mock("../src/components/strategies/PatternEnrollment", () => ({ default: () => null }));

function ids(text: string, type: string, language = "english") {
  return matchWordFormationPatterns(text, type, language).map(match => match.pattern.id);
}

describe("English word formation matching", () => {
  it("contains the full suggested set with valid examples", () => {
    expect(englishWordFormation.patterns.map(pattern => pattern.label)).toEqual([
      "un-", "re-", "dis-", "mis-", "-less", "-ful", "-able / -ible", "-er", "-ness", "-ly",
      "-ment", "-tion / -sion", "-ist", "-ize / -ise",
    ]);
    for (const pattern of englishWordFormation.patterns) {
      expect(pattern.expression.global).toBe(false);
      expect(pattern.expression.sticky).toBe(false);
      expect(ids(pattern.example.word, pattern.wordTypes[0])).toContain(pattern.id);
    }
  });
  it.each([
    ["unhappy", "adjective", ["english_prefix_un"]],
    ["to unlock", "verb", ["english_prefix_un"]],
    ["to rewrite", "verb", ["english_prefix_re"]],
    ["to disagree", "verb", ["english_prefix_dis"]],
    ["to misunderstand", "verb", ["english_prefix_mis"]],
    ["hopeless", "adjective", ["english_suffix_less"]],
    ["helpful", "adjective", ["english_suffix_ful"]],
    ["washable", "adjective", ["english_suffix_able"]],
    ["the teacher", "noun", ["english_suffix_er"]],
    ["a worker", "noun", ["english_suffix_er"]],
    ["an employer", "noun", ["english_suffix_er"]],
    ["the happiness", "noun", ["english_suffix_ness"]],
    ["slowly", "adverb", ["english_suffix_ly"]],
    ["reusable", "adjective", ["english_prefix_re", "english_suffix_able"]],
    ["the unhappiness", "noun", ["english_prefix_un", "english_suffix_ness"]],
    ["  TO   REWRITE ", " Verb ", ["english_prefix_re"]],
    ["visible", "adjective", ["english_suffix_able"]],
    ["the development", "noun", ["english_suffix_ment"]],
    ["information", "noun", ["english_suffix_tion_sion"]],
    ["a decision", "noun", ["english_suffix_tion_sion"]],
    ["the artist", "noun", ["english_suffix_ist"]],
    ["scientist", "noun", ["english_suffix_ist"]],
    ["to modernize", "verb", ["english_suffix_ize_ise"]],
    ["to modernise", "verb", ["english_suffix_ize_ise"]],
  ])("matches %s repeatedly without changing results", (text, type, expected) => {
    for (let i = 0; i < 3; i += 1) expect(ids(text, type)).toEqual(expected);
  });

  it.each([
    ["un", "adjective"], ["re", "verb"], ["less", "adjective"], ["able", "adjective"],
    ["slowly", "adjective"], ["friendly", "adjective"], ["bigger", "adjective"],
    ["helpfulness", "adjective"], ["carefully", "noun"], ["hope", "noun"],
    ["to", "verb"], ["the", "noun"], ["", "verb"],
    ["a helpful teacher", "noun"], ["to rewrite it", "verb"], ["to rewrite", "noun"],
    ["the teacher", "adjective"], ["slowly", "expression"],
    ["sunny", "adjective"], ["lyric", "noun"], ["lessen", "verb"],
    ["development", "adjective"], ["modernise", "noun"], ["artist", "verb"],
    ["ible", "adjective"], ["ment", "noun"], ["tion", "noun"], ["sion", "noun"],
    ["ist", "noun"], ["ize", "verb"], ["ise", "verb"],
  ])("does not match %s (%s)", (text, type) => {
    expect(ids(text, type)).toEqual([]);
  });

  it("preserves case and highlight positions after removing the entry prefix", () => {
    expect(matchWordFormationPatterns("  THE Teacher ", "noun", "english").map(
      ({ word, start, end }) => [word, start, end, word.slice(start, end)],
    )).toEqual([["Teacher", 5, 7, "er"]]);
    expect(matchWordFormationPatterns(" To REWRITE ", "verb", "english").map(
      ({ word, start, end }) => [word, start, end, word.slice(start, end)],
    )).toEqual([["REWRITE", 0, 2, "RE"]]);
  });

  it("returns letter-based candidates, not a verified linguistic analysis", () => {
    expect(ids("readable", "adjective")).toEqual(["english_prefix_re", "english_suffix_able"]);
  });

  it("keeps English and German patterns distinct and leaves other languages unchanged", () => {
    expect(ids("helpful", "adjective", "german")).toEqual([]);
    expect(ids("lesbar", "adjective")).toEqual([]);
    expect(ids("unhappy", "adjective")).toEqual(["english_prefix_un"]);
    expect(ids("unglücklich", "adjective", "german")).toEqual(["german_prefix_un", "german_suffix_lich"]);
    expect(ids("unhappy", "adjective", "spanish")).toEqual([]);
  });
});

describe.each(["en", "es"] as const)("English pattern cards in %s", language => {
  it("provides translated copy for every English pattern", () => {
    localStorage.setItem("app_language", language);
    const { result } = renderHook(useI18n, { wrapper: I18nProvider });
    for (const pattern of englishWordFormation.patterns) {
      expect(result.current.t(pattern.note)).not.toContain("wordFormation.");
      expect(result.current.t(pattern.note).length).toBeGreaterThan(30);
      expect(result.current.t(pattern.example.translation)).not.toContain("wordFormation.");
    }
  });

  it("shows English examples with localized explanations and translations", () => {
    localStorage.setItem("app_language", language);
    const { container } = render(<I18nProvider><WordFormationPatterns targetText="to rewrite" wordType="verb" targetLanguage="english" /></I18nProvider>);
    expect(screen.getByRole("article", { name: "re-" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 4 })).not.toBeInTheDocument();
    expect(container.querySelector(".word-formation-match")).toBeNull();
    expect(container.querySelector(".grammar-phrase-feature-example strong")).toHaveTextContent("re");
    expect(container.querySelector(".word-formation-card > p:first-child")).toHaveTextContent(language === "en" ? /^Re- often/ : /^Re- suele/);
    expect(container.querySelector(".word-formation-card > p:first-child strong")).toHaveTextContent("Re-");
    expect(container.querySelector(".word-formation-patterns > .hint")).toBeNull();
    expect(container.querySelector(".grammar-phrase-feature-example")).toHaveTextContent("write → rewrite");
    expect(container.querySelector(".word-formation-translation")).toHaveTextContent(
      language === "en" ? "write → write again" : "escribir → volver a escribir",
    );
  });

  it.each([
    ["visible", "adjective", "-able / -ible"],
    ["the development", "noun", "-ment"],
    ["the decision", "noun", "-tion / -sion"],
    ["the scientist", "noun", "-ist"],
    ["to modernise", "verb", "-ize / -ise"],
  ])("shows the added pattern for %s", (text, type, label) => {
    localStorage.setItem("app_language", language);
    const { container } = render(<I18nProvider><WordFormationPatterns targetText={text} wordType={type} targetLanguage="english" /></I18nProvider>);
    expect(screen.getByRole("article", { name: label })).toBeInTheDocument();
    expect(Array.from(container.querySelectorAll(".word-formation-card > p:first-child strong"), node => node.textContent)).toEqual(label.split(" / "));
    expect(container.querySelector(".word-formation-translation")).not.toHaveTextContent("wordFormation.");
    expect(container.querySelector(".grammar-phrase-feature-example strong")).not.toBeEmptyDOMElement();
  });
});
