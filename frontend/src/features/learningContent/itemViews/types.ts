import type { AppLanguage } from "../../../i18n";
import type { LearningDefinition } from "../definition";

export interface DefinitionViewProps<D extends LearningDefinition = LearningDefinition> {
  definition: D;
  sourceLanguage: string;
  interfaceLanguage?: AppLanguage;
}
