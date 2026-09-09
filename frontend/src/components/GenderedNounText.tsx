import type { ReactNode } from "react";

import { nounLanguageFeatureFor, type NounGender } from "../languageFeatures/nouns";
import type { StudyLanguageCode } from "../types";

export function nounGenderForLanguage(
  targetText: string,
  targetLanguage: StudyLanguageCode,
): NounGender | null {
  return nounLanguageFeatureFor(targetLanguage)?.genderForText(targetText) || null;
}

function nounForms(targetText: string, pluralText: string, articles: string[]): string[] {
  const articlePattern = articles.map(escapeForRegex).join("|");
  const nounWithoutArticle = (text: string): string => (
    text.trim().replace(new RegExp(`^(?:${articlePattern})\\s+`, "i"), "")
  );
  const singular = nounWithoutArticle(targetText);
  const plural = nounWithoutArticle(pluralText);
  const forms = new Set([singular, plural].filter(Boolean));

  // Cover the regular endings that appear in the compact Forms examples.
  for (const form of [singular, plural]) {
    if (form) {
      forms.add(`${form}n`);
      forms.add(`${form}en`);
      forms.add(`${form}s`);
      forms.add(`${form}es`);
    }
  }

  return [...forms].sort((left, right) => right.length - left.length);
}

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default function GenderedNounText({
  text,
  targetText,
  targetLanguage,
  pluralText = "",
  gender,
}: {
  text: string;
  targetText: string;
  targetLanguage: StudyLanguageCode;
  pluralText?: string;
  gender: NounGender | null;
}): ReactNode {
  const languageFeature = nounLanguageFeatureFor(targetLanguage);
  if (!gender || !text.trim() || !languageFeature) {
    return text;
  }

  const forms = nounForms(targetText, pluralText, languageFeature.articles);
  const { determiners } = languageFeature;
  if (!forms.length) {
    return text;
  }

  const pattern = new RegExp(
    `(?<![\\p{L}])(?:(?:${determiners.map(escapeForRegex).join("|")})\\s+)?(?:${forms.map(escapeForRegex).join("|")})(?![\\p{L}])`,
    "giu",
  );
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <span className={`gender-word-mark gender-word-${gender}`} key={`${match.index}-${match[0]}`}>
        {match[0]}
      </span>,
    );
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex === 0) {
    return text;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

export type { NounGender } from "../languageFeatures/nouns";
