import { germanNounFeature } from "./nouns";
import type { WordFormationLanguageFeature, WordFormationPattern } from "../wordFormation/types";

const patterns: readonly WordFormationPattern[] = [
  {
    id: "german_prefix_un", label: "un-", expression: /^un/iu,
    wordTypes: ["noun", "adjective", "adverb"], note: "wordFormation.un.note",
    example: { base: "glücklich", word: "unglücklich", translation: "wordFormation.un.example" },
  },
  {
    id: "german_suffix_los", label: "-los", expression: /los$/iu,
    wordTypes: ["adjective", "adverb"], note: "wordFormation.los.note",
    example: { base: "Arbeit", word: "arbeitslos", translation: "wordFormation.los.example" },
  },
  {
    id: "german_suffix_bar", label: "-bar", expression: /bar$/iu,
    wordTypes: ["adjective", "adverb"], note: "wordFormation.bar.note",
    example: { base: "essen", word: "essbar", translation: "wordFormation.bar.example" },
  },
  {
    id: "german_suffix_lich", label: "-lich", expression: /lich$/iu,
    wordTypes: ["adjective", "adverb"], note: "wordFormation.lich.note",
    example: { base: "Freund", word: "freundlich", translation: "wordFormation.lich.example" },
  },
  {
    id: "german_suffix_heit", label: "-heit", expression: /heit$/iu,
    wordTypes: ["noun"], note: "wordFormation.heit.note",
    example: { base: "frei", word: "Freiheit", translation: "wordFormation.heit.example" },
  },
  {
    id: "german_suffix_keit", label: "-keit", expression: /keit$/iu,
    wordTypes: ["noun"], note: "wordFormation.keit.note",
    example: { base: "möglich", word: "Möglichkeit", translation: "wordFormation.keit.example" },
  },
  {
    id: "german_suffix_ung", label: "-ung", expression: /ung$/iu,
    wordTypes: ["noun"], note: "wordFormation.ung.note",
    example: { base: "entwickeln", word: "Entwicklung", translation: "wordFormation.ung.example" },
  },
  {
    id: "german_suffix_er", label: "-er", expression: /er$/iu,
    wordTypes: ["noun"], note: "wordFormation.er.note",
    example: { base: "lehren", word: "Lehrer", translation: "wordFormation.er.example" },
  },
  {
    id: "german_suffix_in", label: "-in", expression: /in$/iu,
    wordTypes: ["noun"], note: "wordFormation.in.note",
    example: { base: "Lehrer", word: "Lehrerin", translation: "wordFormation.in.example" },
  },
  {
    id: "german_suffix_chen", label: "-chen", expression: /chen$/iu,
    wordTypes: ["noun"], note: "wordFormation.chen.note",
    example: { base: "Hund", word: "Hündchen", translation: "wordFormation.chen.example" },
  },
];

export const germanWordFormation: WordFormationLanguageFeature = {
  patterns,
  normalizeWord(text, wordType) {
    const parts = text.trim().normalize("NFC").split(/\s+/u);
    if (wordType === "noun" && germanNounFeature.determiners.includes(parts[0].toLowerCase())) {
      parts.shift();
    }
    return parts.join(" ");
  },
};
