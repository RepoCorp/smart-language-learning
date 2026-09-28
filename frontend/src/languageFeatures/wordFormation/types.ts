import type { MessageKey } from "../../i18n";

export type WordFormationPattern = {
  id: string;
  label: string;
  expression: RegExp;
  wordTypes: readonly string[];
  note: MessageKey;
  example: { base: string; word: string; translation: MessageKey };
};

export type WordFormationLanguageFeature = {
  normalizeWord: (text: string, wordType: string) => string;
  patterns: readonly WordFormationPattern[];
};

export type WordFormationMatch = {
  pattern: WordFormationPattern;
  word: string;
  start: number;
  end: number;
};
