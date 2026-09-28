import { germanWordFormation } from "./german/wordFormation";
import { englishWordFormation } from "./english/wordFormation";
import type { WordFormationLanguageFeature, WordFormationMatch } from "./wordFormation/types";

const FEATURES = new Map<string, WordFormationLanguageFeature>([
  ["german", germanWordFormation],
  ["english", englishWordFormation],
]);

export function wordFormationPattern(language: string, key: string) {
  return FEATURES.get(language)?.patterns.find(pattern => pattern.id === key);
}

export function matchWordFormationPatterns(text: string, wordType: string, language: string): WordFormationMatch[] {
  const feature = FEATURES.get(language);
  if (!feature) return [];
  const type = wordType.trim().toLowerCase();
  const word = feature.normalizeWord(text, type);
  // Match one saved word, not an expression or a sentence containing that word.
  if (!/^\p{L}+$/u.test(word)) return [];

  return feature.patterns.flatMap(pattern => {
    if (!pattern.wordTypes.includes(type)) return [];
    const match = pattern.expression.exec(word);
    if (!match || word.length - match[0].length < 2) return [];
    return [{ pattern, word, start: match.index, end: match.index + match[0].length }];
  });
}
