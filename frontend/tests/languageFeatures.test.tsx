import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import GenderedNounText, { nounGenderForLanguage } from "../src/components/GenderedNounText";
import {
  nounFormsContentForGenerationMode,
  supportsNounFormsGenerationMode,
} from "../src/components/strategies/forms/nounFormsStrategyRegistry";

describe("noun language features", () => {
  it("uses the active language feature to identify and mark German noun forms", () => {
    render(
      <GenderedNounText
        text="Ich sehe den Hund."
        targetText="der Hund"
        targetLanguage="german"
        gender={nounGenderForLanguage("der Hund", "german")}
      />,
    );

    expect(screen.getByText("den Hund")).toHaveClass("gender-word-masculine");
  });

  it("uses the active language feature to identify and mark Spanish noun forms", () => {
    render(
      <GenderedNounText
        text="Veo las casas."
        targetText="la casa"
        targetLanguage="spanish"
        gender={nounGenderForLanguage("la casa", "spanish")}
      />,
    );

    expect(screen.getByText("las casas")).toHaveClass("gender-word-feminine");
  });

  it("leaves noun text untouched when the active language has no noun feature", () => {
    render(
      <GenderedNounText
        text="The house is here."
        targetText="the house"
        targetLanguage="english"
        gender={nounGenderForLanguage("the house", "english")}
      />,
    );

    expect(screen.getByText("The house is here.")).not.toHaveClass("gender-word-mark");
  });

  it("dispatches Forms content only for supported generation modes", () => {
    expect(supportsNounFormsGenerationMode("noun_cases_german_v1")).toBe(true);
    expect(supportsNounFormsGenerationMode("noun_forms_spanish_v1")).toBe(true);
    expect(nounFormsContentForGenerationMode("noun_cases_german_v1")).not.toBe(
      nounFormsContentForGenerationMode("noun_forms_spanish_v1"),
    );
    expect(nounFormsContentForGenerationMode("unknown")).toBeNull();
  });
});
