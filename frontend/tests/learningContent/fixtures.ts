import type { AffixPatternDefinition } from "../../src/features/learningContent/patterns/affix/definition";

export const keit: AffixPatternDefinition = {
  key: "german_suffix_keit", language: "german", affix: "-keit", position: "suffix", word_types: ["noun"],
  item_view: "affix_pattern", strategies: ["affix_examples"], exercises: [], evaluations: { source_to_target: "affix_production" },
  display: {
    en: { title: "-keit", explanation: "Names a quality or state." },
    es: { title: "-keit", explanation: "Expresa una cualidad o un estado." },
  },
  examples: [{
    base: "möglich", result: "die Möglichkeit",
    translations: {
      english: { base: "possible", result: "possibility" },
      spanish: { base: "posible", result: "posibilidad" },
    },
  }, ...[
    ["sauber", "die Sauberkeit", "clean", "cleanliness", "limpio", "limpieza"],
    ["freundlich", "die Freundlichkeit", "friendly", "friendliness", "amable", "amabilidad"],
    ["traurig", "die Traurigkeit", "sad", "sadness", "triste", "tristeza"],
    ["höflich", "die Höflichkeit", "polite", "politeness", "cortés", "cortesía"],
    ["einsam", "die Einsamkeit", "lonely", "loneliness", "solitario", "soledad"],
  ].map(([base, result, englishBase, englishResult, spanishBase, spanishResult]) => ({
    base, result,
    translations: {
      english: { base: englishBase, result: englishResult },
      spanish: { base: spanishBase, result: spanishResult },
    },
  }))],
};
