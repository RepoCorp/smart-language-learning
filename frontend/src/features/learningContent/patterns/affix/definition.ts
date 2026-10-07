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
