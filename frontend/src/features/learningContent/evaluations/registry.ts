import AffixProductionEvaluation from "../patterns/affix/AffixProductionEvaluation";
import AffixProductionSession from "../patterns/affix/AffixProductionSession";
import AffixRecognitionEvaluation from "../patterns/affix/AffixRecognitionEvaluation";
import AffixRecognitionSession from "../patterns/affix/AffixRecognitionSession";
import { isAffixPatternDefinition } from "../patterns/affix/definition";
import { withDefinition } from "../itemViews/withDefinition";

const evaluations = {
  affix_production: { View: withDefinition(isAffixPatternDefinition, AffixProductionEvaluation), SessionView: AffixProductionSession, label: "buildWord" as const },
  affix_recognition: { View: withDefinition(isAffixPatternDefinition, AffixRecognitionEvaluation), SessionView: AffixRecognitionSession, label: "understandWord" as const },
};

export function getEvaluation(id: string): (typeof evaluations)[keyof typeof evaluations] | undefined {
  return Object.prototype.hasOwnProperty.call(evaluations, id) ? evaluations[id as keyof typeof evaluations] : undefined;
}
