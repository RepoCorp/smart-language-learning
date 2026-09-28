import type { WordFormationLanguageFeature, WordFormationPattern } from "../wordFormation/types";

const patterns: readonly WordFormationPattern[] = [
  {
    id: "english_prefix_un", label: "un-", expression: /^un/iu,
    wordTypes: ["adjective", "noun", "verb", "adverb"], note: "wordFormation.english.un.note",
    example: { base: "happy", word: "unhappy", translation: "wordFormation.english.un.example" },
  },
  {
    id: "english_prefix_re", label: "re-", expression: /^re/iu,
    wordTypes: ["verb", "noun", "adjective", "adverb"], note: "wordFormation.english.re.note",
    example: { base: "write", word: "rewrite", translation: "wordFormation.english.re.example" },
  },
  {
    id: "english_prefix_dis", label: "dis-", expression: /^dis/iu,
    wordTypes: ["verb", "noun", "adjective", "adverb"], note: "wordFormation.english.dis.note",
    example: { base: "agree", word: "disagree", translation: "wordFormation.english.dis.example" },
  },
  {
    id: "english_prefix_mis", label: "mis-", expression: /^mis/iu,
    wordTypes: ["verb", "noun", "adjective", "adverb"], note: "wordFormation.english.mis.note",
    example: { base: "understand", word: "misunderstand", translation: "wordFormation.english.mis.example" },
  },
  {
    id: "english_suffix_less", label: "-less", expression: /less$/iu,
    wordTypes: ["adjective"], note: "wordFormation.english.less.note",
    example: { base: "hope", word: "hopeless", translation: "wordFormation.english.less.example" },
  },
  {
    id: "english_suffix_ful", label: "-ful", expression: /ful$/iu,
    wordTypes: ["adjective"], note: "wordFormation.english.ful.note",
    example: { base: "help", word: "helpful", translation: "wordFormation.english.ful.example" },
  },
  {
    id: "english_suffix_able", label: "-able / -ible", expression: /(?:able|ible)$/iu,
    wordTypes: ["adjective"], note: "wordFormation.english.able.note",
    example: { base: "wash", word: "washable", translation: "wordFormation.english.able.example" },
  },
  {
    id: "english_suffix_er", label: "-er", expression: /er$/iu,
    wordTypes: ["noun"], note: "wordFormation.english.er.note",
    example: { base: "teach", word: "teacher", translation: "wordFormation.english.er.example" },
  },
  {
    id: "english_suffix_ness", label: "-ness", expression: /ness$/iu,
    wordTypes: ["noun"], note: "wordFormation.english.ness.note",
    example: { base: "happy", word: "happiness", translation: "wordFormation.english.ness.example" },
  },
  {
    id: "english_suffix_ly", label: "-ly", expression: /ly$/iu,
    wordTypes: ["adverb"], note: "wordFormation.english.ly.note",
    example: { base: "slow", word: "slowly", translation: "wordFormation.english.ly.example" },
  },
  {
    id: "english_suffix_ment", label: "-ment", expression: /ment$/iu,
    wordTypes: ["noun"], note: "wordFormation.english.ment.note",
    example: { base: "develop", word: "development", translation: "wordFormation.english.ment.example" },
  },
  {
    id: "english_suffix_tion_sion", label: "-tion / -sion", expression: /(?:tion|sion)$/iu,
    wordTypes: ["noun"], note: "wordFormation.english.tionSion.note",
    example: { base: "inform", word: "information", translation: "wordFormation.english.tionSion.example" },
  },
  {
    id: "english_suffix_ist", label: "-ist", expression: /ist$/iu,
    wordTypes: ["noun"], note: "wordFormation.english.ist.note",
    example: { base: "art", word: "artist", translation: "wordFormation.english.ist.example" },
  },
  {
    id: "english_suffix_ize_ise", label: "-ize / -ise", expression: /(?:ize|ise)$/iu,
    wordTypes: ["verb"], note: "wordFormation.english.izeIse.note",
    example: { base: "modern", word: "modernize", translation: "wordFormation.english.izeIse.example" },
  },
];

export const englishWordFormation: WordFormationLanguageFeature = {
  patterns,
  normalizeWord(text, wordType) {
    const word = text.trim().normalize("NFC");
    if (wordType === "noun") return word.replace(/^(?:the|an?)\s+/iu, "");
    if (wordType === "verb") return word.replace(/^to\s+/iu, "");
    return word;
  },
};
