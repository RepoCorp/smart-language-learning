import type { LearningDefinition } from "../../definition";

export interface AffixExample {
  base: string;
  result: string;
  translations: Readonly<Record<string, { base: string; result: string } | undefined>>;
}

export interface AffixPatternDefinition extends LearningDefinition {
  affix: string;
  position: "prefix" | "suffix";
  word_types: readonly string[];
  examples: readonly AffixExample[];
}

export function isAffixPatternDefinition(definition: LearningDefinition): definition is AffixPatternDefinition {
  const candidate = definition as Partial<AffixPatternDefinition>;
  return candidate.item_view === "affix_pattern" && typeof candidate.affix === "string"
    && (candidate.position === "prefix" || candidate.position === "suffix")
    && Array.isArray(candidate.word_types) && candidate.word_types.every(type => typeof type === "string")
    && Array.isArray(candidate.examples) && candidate.examples.every(isAffixExample);
}

function isAffixExample(value: unknown): value is AffixExample {
  if (!value || typeof value !== "object") return false;
  const example = value as Partial<AffixExample>;
  return typeof example.base === "string" && typeof example.result === "string"
    && !!example.translations && typeof example.translations === "object" && !Array.isArray(example.translations)
    && Object.values(example.translations).every(translation => translation === undefined || (
      translation && typeof translation.base === "string" && typeof translation.result === "string"
    ));
}
