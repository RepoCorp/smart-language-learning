import type { AffixPatternDefinition } from "../../src/features/learningContent/patterns/affix/definition";
import type { WordDefinition } from "../../src/features/learningContent/words/definition";
import type { PhraseDefinition } from "../../src/features/learningContent/phrases/definition";

export const word: WordDefinition = {
  key: "german_word_moeglichkeit", language: "german", item_view: "word",
  text: "die Möglichkeit", word_type: "noun", gender: "feminine",
  translations: { english: "the possibility", spanish: "la posibilidad" },
  display: {
    en: { title: "die Möglichkeit", explanation: "A possibility or an available option. This noun uses die; its plural is die Möglichkeiten." },
    es: { title: "die Möglichkeit", explanation: "Una posibilidad o una opción disponible. Este sustantivo lleva die; su plural es die Möglichkeiten." },
  },
  strategies: [], exercises: [], evaluations: {},
};

export const phrase: PhraseDefinition = {
  key: "german_phrase_repeat_request", language: "german", item_view: "phrase",
  text: "Könnten Sie das bitte wiederholen?",
  translations: { english: "Could you please repeat that?", spanish: "¿Podría repetir eso, por favor?" },
  display: {
    en: { title: "Könnten Sie das bitte wiederholen?", explanation: "A polite way to ask someone to repeat what they said. Sie is the formal way to address them." },
    es: { title: "Könnten Sie das bitte wiederholen?", explanation: "Una forma cortés de pedir que alguien repita lo que dijo. Sie se usa para dirigirse a esa persona de usted." },
  },
  strategies: [], exercises: [], evaluations: {},
};

export const keit: AffixPatternDefinition = {
  key: "german_suffix_keit", language: "german", affix: "-keit", position: "suffix", word_types: ["noun"],
  item_view: "affix_pattern", strategies: ["affix_examples", "affix_bank_words"], exercises: [],
  evaluations: { source_to_target: "affix_production", target_to_source: "affix_recognition" },
  display: {
    en: { title: "-keit", explanation: "Names a quality or state." },
    es: { title: "-keit", explanation: "Expresa una cualidad o un estado." },
  },
  examples: [{
    base: "möglich", result: "die Möglichkeit",
    translations: {
      english: { base: "possible", result: "the possibility" },
      spanish: { base: "posible", result: "la posibilidad" },
    },
  }, ...[
    ["sauber", "die Sauberkeit", "clean", "the cleanliness", "limpio", "la limpieza"],
    ["freundlich", "die Freundlichkeit", "friendly", "the friendliness", "amable", "la amabilidad"],
    ["traurig", "die Traurigkeit", "sad", "the sadness", "triste", "la tristeza"],
    ["höflich", "die Höflichkeit", "polite", "the politeness", "cortés", "la cortesía"],
    ["einsam", "die Einsamkeit", "lonely", "the loneliness", "solitario", "la soledad"],
  ].map(([base, result, englishBase, englishResult, spanishBase, spanishResult]) => ({
    base, result,
    translations: {
      english: { base: englishBase, result: englishResult },
      spanish: { base: spanishBase, result: spanishResult },
    },
  }))],
};
