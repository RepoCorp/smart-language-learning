import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { I18nProvider, useI18n, type AppLanguage } from "../src/i18n";
import { GERMAN_PHRASE_GRAMMAR_FEATURE_PRESENTATION as german } from "../src/components/strategies/germanPhraseGrammarFeaturePresentation";
import { ENGLISH_PHRASE_GRAMMAR_FEATURE_PRESENTATION as english } from "../src/components/strategies/englishPhraseGrammarFeaturePresentation";
import { SPANISH_PHRASE_GRAMMAR_FEATURE_PRESENTATION as spanish } from "../src/components/strategies/spanishPhraseGrammarFeaturePresentation";

// These explanations should not require a grammar vocabulary to understand.
const technicalTerms = /\b(modal|infinitive|infinitivo|participle|participio|subjunctive|subjuntivo|konjunktiv|auxiliary|auxiliar|conjugated|conjugado|conjugation|conjugación|subordinate|subordinada|gerund|gerundio|nominative|nominativo|accusative|acusativo|dative|dativo|genitive|genitivo|direct.object|indirect.object|objeto directo|objeto indirecto|present perfect|present continuous|presente perfecto|presente continuo)\b/i;

describe.each<AppLanguage>(["en", "es"])("learner grammar wording (%s)", (language) => {
  it.each(Object.entries({ german, english, spanish }))("keeps every %s rule readable without technical grammar terms", (_, catalog) => {
    window.localStorage.setItem("app_language", language);
    const { result } = renderHook(useI18n, { wrapper: I18nProvider });
    for (const [feature, presentation] of Object.entries(catalog)) {
      const title = result.current.t(presentation.title);
      const note = result.current.t(presentation.present);
      expect(title, feature).not.toMatch(technicalTerms);
      expect(note, feature).not.toMatch(technicalTerms);
      expect(note.length, feature).toBeGreaterThan(40);
      expect(note, feature).not.toContain("strategies.grammar.");
      expect(presentation.example, feature).toBeTruthy();
    }
  });

  it("keeps the personalized noun and pronoun placeholders working", () => {
    window.localStorage.setItem("app_language", language);
    const { result } = renderHook(useI18n, { wrapper: I18nProvider });
    expect(result.current.t("strategies.grammar.genderNote", { noun: "der Hund" })).toContain("der Hund");
    expect(result.current.t("strategies.grammar.pronounNote", { pronoun: "er" })).toContain("er");
    for (const key of ["verbInfinitiveNote", "verbStemNote", "verbPresentNote", "verbPerfectNote", "verbSimplePastNote", "verbFutureNote", "pluralNote", "casesNote", "adjectiveNote"] as const) {
      expect(result.current.t(`strategies.grammar.${key}`)).not.toMatch(technicalTerms);
    }
  });
});
