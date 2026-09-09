import type { StudyLanguageCode } from "../types";
import { germanNounFeature } from "./german/nouns";
import { spanishNounFeature } from "./spanish/nouns";
import type { NounLanguageFeature } from "./nouns/types";

const NOUN_FEATURES: Partial<Record<StudyLanguageCode, NounLanguageFeature>> = {
  german: germanNounFeature,
  spanish: spanishNounFeature,
};

export function nounLanguageFeatureFor(language: StudyLanguageCode): NounLanguageFeature | null {
  return NOUN_FEATURES[language] || null;
}

export type { NounGender, NounLanguageFeature } from "./nouns/types";
