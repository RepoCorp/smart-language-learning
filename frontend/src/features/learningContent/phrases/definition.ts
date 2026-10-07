import type { LearningDefinition } from "../definition";

export interface PhraseDefinition extends LearningDefinition {
  item_view: "phrase";
  text: string;
  translations: Readonly<Record<string, string | undefined>>;
}

export function isPhraseDefinition(definition: LearningDefinition): definition is PhraseDefinition {
  const phrase = definition as Partial<PhraseDefinition>;
  return definition.item_view === "phrase"
    && typeof phrase.text === "string" && phrase.text.trim().length > 0
    && typeof phrase.translations === "object" && phrase.translations !== null && !Array.isArray(phrase.translations)
    && Object.values(phrase.translations).every(value => value === undefined || typeof value === "string");
}
