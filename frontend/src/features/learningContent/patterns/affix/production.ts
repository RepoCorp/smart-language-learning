import type { AffixExample, AffixPatternDefinition } from "./definition";

export interface AffixProductionData {
  base: string;
  base_translation: string;
  meaning: string;
  answer: string;
  highlight: [number, number];
}

export function prepareAffixProduction(definition: AffixPatternDefinition, example: AffixExample | undefined, sourceLanguage: string): AffixProductionData | null {
  const translation = example?.translations[sourceLanguage];
  if (!example || !translation) return null;
  const affix = definition.affix.replace(/^-|-$/g, "");
  const start = definition.position === "prefix" ? 0 : example.result.length - affix.length;
  const matches = affix.length > 0 && example.result.slice(start, start + affix.length).toLowerCase() === affix.toLowerCase();
  return {
    base: example.base, base_translation: translation.base, meaning: translation.result,
    answer: example.result, highlight: matches ? [start, start + affix.length] : [0, 0],
  };
}

export function isAffixProductionData(value: unknown): value is AffixProductionData {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<AffixProductionData>;
  return [data.base, data.base_translation, data.meaning, data.answer].every(text => typeof text === "string" && text.trim())
    && Array.isArray(data.highlight) && data.highlight.length === 2
    && data.highlight.every(Number.isInteger)
    && data.highlight[0] >= 0 && data.highlight[1] >= data.highlight[0]
    && data.highlight[1] <= data.answer!.length;
}
