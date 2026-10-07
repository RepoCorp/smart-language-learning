import type { LearningDefinition } from "../definition";

export interface WordDefinition extends LearningDefinition {
  item_view: "word";
  text: string;
  translations: Readonly<Record<string, string | undefined>>;
  word_type: string;
  gender: "masculine" | "feminine" | "neuter" | null;
}

export function isWordDefinition(definition: LearningDefinition): definition is WordDefinition {
  const word = definition as Partial<WordDefinition>;
  return definition.item_view === "word"
    && typeof word.text === "string" && word.text.trim().length > 0
    && typeof word.word_type === "string" && word.word_type.trim().length > 0
    && (word.gender === null || word.gender === "masculine" || word.gender === "feminine" || word.gender === "neuter")
    && typeof word.translations === "object" && word.translations !== null && !Array.isArray(word.translations)
    && Object.values(word.translations).every(value => value === undefined || typeof value === "string");
}
