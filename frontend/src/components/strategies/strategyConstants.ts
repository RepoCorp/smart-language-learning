export const DEFAULT_STRATEGY = "Forms";
export const PERSONALIZE_STRATEGY = "Personalize";
export const PRACTICE_STRATEGY = "Practice";
export const CONNECT_STRATEGY = "Connect";
export const VISUALIZE_STRATEGY = "Visualize";
export const ACT_STRATEGY = "Act";
export const WALK_STRATEGY = "Walk";
export const DECODE_STRATEGY = "Decode";

export const WORD_STRATEGIES = [
  DEFAULT_STRATEGY,
  PERSONALIZE_STRATEGY,
  PRACTICE_STRATEGY,
  CONNECT_STRATEGY,
  VISUALIZE_STRATEGY,
  ACT_STRATEGY,
  "Sing",
  WALK_STRATEGY,
  DECODE_STRATEGY,
  "Encounter",
  "Compare",
] as const;

export const PHRASE_STRATEGIES = [
  DEFAULT_STRATEGY,
  PRACTICE_STRATEGY,
  CONNECT_STRATEGY,
  VISUALIZE_STRATEGY,
  ACT_STRATEGY,
  "Sing",
  WALK_STRATEGY,
  "Encounter",
  "Compare",
] as const;
