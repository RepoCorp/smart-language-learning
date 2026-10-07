import type { StudyLanguageCode } from "../../types";
import { nounLanguageFeatureFor } from "../nouns";
import type { NounGender } from "./types";

export function nounTitleForLanguage(
  targetText: string,
  targetLanguage: StudyLanguageCode,
): { article: string; noun: string; gender: NounGender } | null {
  const feature = nounLanguageFeatureFor(targetLanguage);
  if (!feature) return null;

  const match = targetText.trim().match(/^(\S+)\s+(.+)$/);
  if (!match || !feature.articles.includes(match[1].toLowerCase())) return null;

  const gender = feature.genderForText(targetText);
  if (!gender) return null;

  return { article: match[1], noun: match[2], gender };
}
