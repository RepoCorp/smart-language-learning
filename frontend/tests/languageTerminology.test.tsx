import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { I18nProvider, useI18n } from "../src/i18n";

const instructionKeys = [
  "conversation.helpDescription",
  "conversation.helpSayInputPlaceholder",
  "content.level.description",
  "content.requiredWords.languageTarget",
  "content.requiredWords.languageSource",
  "content.requiredWords.hint",
  "dialogs.selectedPhraseHint",
  "content.result.dialogWordHint",
  "newItem.createDescription",
  "newItem.examplesDescription",
  "newItem.conversationDescription",
  "newItem.sentenceAddMissingSource",
  "phrase.situationPrompt",
  "phrase.situationUnavailable",
  "words.searchPlaceholder",
  "config.grammarPoolSubtitle",
] as const;

describe("learner-friendly language terminology", () => {
  it("uses clear language labels and instructions in both interface languages", () => {
    const { result } = renderHook(() => useI18n(), { wrapper: I18nProvider });
    for (const language of ["en", "es"] as const) {
      act(() => result.current.setLanguage(language));
      for (const key of instructionKeys) {
        const text = result.current.t(key);
        expect(text).not.toBe(key);
        expect(text).not.toMatch(/\b(source|target|origen|objetivo|destino|fuente)\b/i);
      }
      expect(result.current.t("content.requiredWords.languageSource")).toBe(
        language === "en" ? "In the language I speak" : "En el idioma que hablo",
      );
      expect(result.current.t("content.requiredWords.languageTarget")).toBe(
        language === "en" ? "In the language I'm learning" : "En el idioma que estoy aprendiendo",
      );
      expect(result.current.t("config.studySourceLanguage")).toBe(language === "en" ? "I speak" : "Hablo");
      expect(result.current.t("config.studyTargetLanguage")).toBe(language === "en" ? "I'm learning" : "Estoy aprendiendo");
    }
  });
});
