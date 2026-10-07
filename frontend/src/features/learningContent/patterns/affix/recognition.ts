import type { AffixExample } from "./definition";

export interface AffixRecognitionData {
  base: string;
  base_translation: string;
  word: string;
  answer: string;
}

export function prepareAffixRecognition(example: AffixExample | undefined, sourceLanguage: string): AffixRecognitionData | null {
  const translation = example?.translations[sourceLanguage];
  if (!example || !translation) return null;
  return {
    base: example.base, base_translation: translation.base,
    word: example.result, answer: translation.result,
  };
}

export function isAffixRecognitionData(value: unknown): value is AffixRecognitionData {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<AffixRecognitionData>;
  return [data.base, data.base_translation, data.word, data.answer]
    .every(text => typeof text === "string" && text.trim());
}
