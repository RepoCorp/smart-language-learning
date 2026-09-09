import type { ComponentType } from "react";

import GermanNounFormsStrategyContent from "./GermanNounFormsStrategyContent";
import type { NounFormsStrategyContentProps } from "./nounFormsTypes";
import SpanishNounFormsStrategyContent from "./SpanishNounFormsStrategyContent";

const CONTENT_BY_GENERATION_MODE: Record<string, ComponentType<NounFormsStrategyContentProps>> = {
  noun_cases_german_v1: GermanNounFormsStrategyContent,
  noun_forms_spanish_v1: SpanishNounFormsStrategyContent,
};

export function nounFormsContentForGenerationMode(
  generationMode: string | undefined,
): ComponentType<NounFormsStrategyContentProps> | null {
  return CONTENT_BY_GENERATION_MODE[String(generationMode || "").trim()] || null;
}

export function supportsNounFormsGenerationMode(generationMode: string | undefined): boolean {
  return Boolean(nounFormsContentForGenerationMode(generationMode));
}
