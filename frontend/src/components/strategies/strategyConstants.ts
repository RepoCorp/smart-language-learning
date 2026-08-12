export const DEFAULT_STRATEGY = "Forms";
export const CREATE_STRATEGY = "Create";
export const EXAMPLES_STRATEGY = "Examples";
export const RELATED_STRATEGY = "Related";
export const VISUALIZE_STRATEGY = "Visualize";
export const ACT_STRATEGY = "Act";
export const WALK_STRATEGY = "Walk";
export const DECODE_STRATEGY = "Decode";
export const ENCOUNTER_STRATEGY = "Encounter";
export const COMPARE_STRATEGY = "Compare";
export const SING_STRATEGY = "Sing";
export const GRAMMAR_STRATEGY = "Grammar";

export const STRATEGY_LABELS: Record<string, string> = {
  [CREATE_STRATEGY]: "Create",
  [DEFAULT_STRATEGY]: "Forms",
  [EXAMPLES_STRATEGY]: "Examples",
  [COMPARE_STRATEGY]: "Compare",
  [RELATED_STRATEGY]: "Related",
  [ENCOUNTER_STRATEGY]: "Encounter",
  [DECODE_STRATEGY]: "Decode",
  [VISUALIZE_STRATEGY]: "Visualize",
  [ACT_STRATEGY]: "Act",
  [WALK_STRATEGY]: "Walk",
  [SING_STRATEGY]: "Sing",
  [GRAMMAR_STRATEGY]: "Grammar",
};

export const WORD_STRATEGIES = [
  CREATE_STRATEGY,
  DEFAULT_STRATEGY,
  EXAMPLES_STRATEGY,
  COMPARE_STRATEGY,
  RELATED_STRATEGY,
  ENCOUNTER_STRATEGY,
  DECODE_STRATEGY,
  VISUALIZE_STRATEGY,
  ACT_STRATEGY,
  WALK_STRATEGY,
  SING_STRATEGY,
  GRAMMAR_STRATEGY,
] as const;

export const PHRASE_STRATEGIES = [
  DEFAULT_STRATEGY,
  EXAMPLES_STRATEGY,
  RELATED_STRATEGY,
  ENCOUNTER_STRATEGY,
  VISUALIZE_STRATEGY,
  ACT_STRATEGY,
  WALK_STRATEGY,
  SING_STRATEGY,
  GRAMMAR_STRATEGY,
] as const;

export function firstStrategyForItemType(itemType: "word" | "phrase"): string {
  return itemType === "word" ? CREATE_STRATEGY : DEFAULT_STRATEGY;
}
