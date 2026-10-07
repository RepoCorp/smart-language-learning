import type { AffixPatternDefinition } from "../../src/features/learningContent/patterns/affix/definition";

export const keit: AffixPatternDefinition = {
  key: "german_suffix_keit", language: "german", affix: "-keit", position: "suffix", word_types: ["noun"],
  item_view: "affix_pattern", strategies: ["affix_examples"], exercises: [],
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
