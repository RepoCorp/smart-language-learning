export interface LearningDefinition {
  key: string;
  language: string;
  display: Readonly<Record<string, { title: string; explanation: string } | undefined>>;
  item_view: string;
  strategies: readonly string[];
  exercises: readonly string[];
  evaluations: Readonly<Partial<Record<"source_to_target" | "target_to_source", string>>>;
}
