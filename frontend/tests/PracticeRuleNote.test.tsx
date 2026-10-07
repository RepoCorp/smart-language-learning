import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../src/i18n";
import { StudyLanguagesProvider } from "../src/studyLanguages";
import PracticeRuleNote from "../src/components/session/PracticeRuleNote";
import PatternReview from "../src/components/session/PatternReview";
import SessionCurrentItem from "../src/components/session/SessionCurrentItem";
import type { SessionItem } from "../src/types";

vi.mock("../src/components/LegacyItemView", () => ({ default: () => <div>New item</div> }));
vi.mock("../src/components/PhraseReview", () => ({ default: () => <div>Phrase exercise</div> }));
vi.mock("../src/components/WordReview", () => ({ default: () => <div>Word exercise</div> }));
vi.mock("../src/components/WordPartsReview", () => ({ default: () => <div>Word blocks</div> }));

const item: SessionItem = {
  id: 1, item_type: "phrase", mode: "review", direction: "es_to_de",
  german_text: "Ich muss gehen.", spanish_text: "Tengo que ir.", options: [],
  repeatedAfterFailure: true, repeatPracticeStep: "phrase_progressive_blocks",
  practice_grammar_feature_keys: ["verb_position_main_clause"],
};

describe("exercise rule explanations", () => {
  it.each(["en", "es"])("localizes the explanation in %s and omits unknown rules", (language) => {
    localStorage.setItem("app_language", language);
    render(<I18nProvider><PracticeRuleNote grammarFeatureKeys={[
      "verb_position_main_clause", "verb_position_main_clause", "unknown_rule",
    ]} /></I18nProvider>);
    expect(screen.getByRole("note")).toHaveTextContent(language === "es" ? "Patrón que practicas" : "Pattern you're practising");
    expect(screen.getByRole("note").querySelectorAll("li")).toHaveLength(1);
    expect(screen.getByRole("note").querySelector("p")!.textContent!.length).toBeGreaterThan(30);
    expect(screen.getByRole("note")).not.toHaveTextContent("verb_position_main_clause");
    expect(screen.getByRole("note")).not.toHaveTextContent("unknown_rule");
  });

  it.each(["phrase_progressive_blocks", "phrase_builder"] as const)("shows the rule for %s, not ordinary reviews", (step) => {
    const props = { renderKey: "one", reviewComplete: false, onNewItemContinue: vi.fn(), onReviewAnswered: vi.fn(), onNextItem: vi.fn() };
    const view = render(<SessionCurrentItem {...props} item={{ ...item, repeatPracticeStep: step }} />);
    expect(screen.getByRole("note")).toBeInTheDocument();
    expect(screen.getByText("Phrase exercise")).toBeInTheDocument();
    view.rerender(<SessionCurrentItem {...props} item={{ ...item, repeatedAfterFailure: false, repeatPracticeStep: undefined }} />);
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
    view.rerender(<SessionCurrentItem {...props} item={{ ...item, practice_grammar_feature_keys: [] }} />);
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("does not render empty or unsupported explanations", () => {
    render(<PracticeRuleNote grammarFeatureKeys={["unknown_rule"]} patternKey="unknown_pattern" />);
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it.each(["es_to_de", "de_to_es"] as const)("shows word-building explanations only after reveal (%s)", (direction) => {
    localStorage.setItem("study_target_language", "english");
    const pattern: SessionItem = { ...item, item_type: "pattern", direction,
      pattern_key: "english_suffix_less", pattern_exercise: {
        base: "hope", base_translation: "esperanza", question: "Question", answer: "hopeless", meaning: "sin esperanza", highlight: [4, 8],
      },
    };
    render(<StudyLanguagesProvider><PatternReview item={pattern} completed={false} disabled={false} onAnswered={vi.fn()} onNext={vi.fn()} /></StudyLanguagesProvider>);
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reveal answer" }));
    expect(screen.getByRole("note")).toHaveTextContent("-less");
    expect(screen.getByRole("note").querySelector("p")!.textContent!.length).toBeGreaterThan(30);
  });
});
