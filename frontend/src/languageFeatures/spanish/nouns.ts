import type { NounLanguageFeature } from "../nouns/types";

const ARTICLES = ["el", "la", "los", "las"];

export function spanishNounGender(targetText: string): "masculine" | "feminine" | null {
  const article = targetText.trim().split(/\s+/, 1)[0]?.toLowerCase();
  if (article === "el" || article === "los") return "masculine";
  if (article === "la" || article === "las") return "feminine";
  return null;
}

export const spanishNounFeature: NounLanguageFeature = {
  articles: ARTICLES,
  determiners: [
    "el", "la", "los", "las",
    "un", "una", "unos", "unas",
    "ningún", "ninguna", "ningunos", "ningunas",
    "este", "esta", "estos", "estas",
    "ese", "esa", "esos", "esas",
    "mi", "mis",
  ],
  genderForText: spanishNounGender,
};
