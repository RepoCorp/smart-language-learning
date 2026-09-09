import type { NounLanguageFeature } from "../nouns/types";

const ARTICLES = ["der", "die", "das"];

export function germanNounGender(targetText: string): "masculine" | "feminine" | "neuter" | null {
  const article = targetText.trim().split(/\s+/, 1)[0]?.toLowerCase();
  if (article === "der") return "masculine";
  if (article === "die") return "feminine";
  if (article === "das") return "neuter";
  return null;
}

export const germanNounFeature: NounLanguageFeature = {
  articles: ARTICLES,
  determiners: [
    "der", "die", "das", "den", "dem", "des",
    "ein", "eine", "einen", "einem", "eines",
    "kein", "keine", "keinen", "keinem", "keines",
    "mein", "meine", "meinen", "meinem", "meines",
    "dein", "deine", "deinen", "deinem", "deines",
    "sein", "seine", "seinen", "seinem", "seines",
    "ihr", "ihre", "ihren", "ihrem", "ihres",
    "unser", "unsere", "unseren", "unserem", "unseres",
    "euer", "eure", "euren", "eurem", "eures",
    "dieser", "diese", "dieses", "diesen", "diesem",
  ],
  genderForText: germanNounGender,
};
