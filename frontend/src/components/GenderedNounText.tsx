import type { ReactNode } from "react";

export type GermanNounGender = "masculine" | "feminine" | "neuter";

const DETERMINER_PATTERN = [
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
].join("|");

function nounWithoutArticle(text: string): string {
  return text.trim().replace(/^(?:der|die|das)\s+/i, "");
}

export function germanNounGender(targetText: string): GermanNounGender | null {
  const article = targetText.trim().split(/\s+/, 1)[0]?.toLowerCase();
  if (article === "der") return "masculine";
  if (article === "die") return "feminine";
  if (article === "das") return "neuter";
  return null;
}

function nounForms(targetText: string, pluralText: string): string[] {
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
  pluralText = "",
  gender,
}: {
  text: string;
  targetText: string;
  pluralText?: string;
  gender: GermanNounGender | null;
}): ReactNode {
  if (!gender || !text.trim()) {
    return text;
  }

  const forms = nounForms(targetText, pluralText);
  if (!forms.length) {
    return text;
  }

  const pattern = new RegExp(
    `(?<![\\p{L}])(?:(?:${DETERMINER_PATTERN})\\s+)?(?:${forms.map(escapeForRegex).join("|")})(?![\\p{L}])`,
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
