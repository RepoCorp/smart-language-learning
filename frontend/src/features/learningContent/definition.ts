export interface LearningDefinition {
  key: string;
  language: string;
  display: Readonly<Record<string, { title: string; explanation: string } | undefined>>;
  item_view: string;
  strategies: readonly string[];
  exercises: readonly string[];
  evaluations: Readonly<Partial<Record<"source_to_target" | "target_to_source", string>>>;
}

export function isLearningDefinition(value: unknown): value is LearningDefinition {
  if (!value || typeof value !== "object") return false;
  const definition = value as Partial<LearningDefinition>;
  const strings = (entries: unknown): entries is string[] => Array.isArray(entries)
    && entries.every(entry => typeof entry === "string");
  return typeof definition.key === "string" && typeof definition.language === "string"
    && typeof definition.item_view === "string"
    && !!definition.display && typeof definition.display === "object" && !Array.isArray(definition.display)
    && Object.values(definition.display).every(display => display === undefined || (
      display && typeof display.title === "string" && typeof display.explanation === "string"
    ))
    && strings(definition.strategies) && strings(definition.exercises)
    && !!definition.evaluations && typeof definition.evaluations === "object" && !Array.isArray(definition.evaluations)
    && Object.values(definition.evaluations).every(id => typeof id === "string");
}
