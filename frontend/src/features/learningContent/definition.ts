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

  if (typeof definition.key !== "string") return false;
  if (typeof definition.language !== "string") return false;
  if (typeof definition.item_view !== "string") return false;
  if (!hasValidDisplayText(definition.display)) return false;
  if (!isStringList(definition.strategies)) return false;
  if (!isStringList(definition.exercises)) return false;
  if (!hasValidEvaluationIds(definition.evaluations)) return false;

  return true;
}

function hasValidDisplayText(display: LearningDefinition["display"] | undefined): boolean {
  if (!display || typeof display !== "object" || Array.isArray(display)) return false;

  for (const translation of Object.values(display)) {
    if (translation === undefined) continue;
    if (!translation) return false;
    if (typeof translation.title !== "string") return false;
    if (typeof translation.explanation !== "string") return false;
  }

  return true;
}

function isStringList(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  return value.every(entry => typeof entry === "string");
}

function hasValidEvaluationIds(evaluations: LearningDefinition["evaluations"] | undefined): boolean {
  if (!evaluations || typeof evaluations !== "object" || Array.isArray(evaluations)) return false;
  return Object.values(evaluations).every(id => typeof id === "string");
}
