import AffixProductionEvaluation from "../patterns/affix/AffixProductionEvaluation";
import AffixProductionSession from "../patterns/affix/AffixProductionSession";
import AffixRecognitionEvaluation from "../patterns/affix/AffixRecognitionEvaluation";
import AffixRecognitionSession from "../patterns/affix/AffixRecognitionSession";

const evaluations = {
  affix_production: { View: AffixProductionEvaluation, SessionView: AffixProductionSession, label: "buildWord" as const },
  affix_recognition: { View: AffixRecognitionEvaluation, SessionView: AffixRecognitionSession, label: "understandWord" as const },
};

export function getEvaluation(id: string): (typeof evaluations)[keyof typeof evaluations] | undefined {
  return Object.prototype.hasOwnProperty.call(evaluations, id) ? evaluations[id as keyof typeof evaluations] : undefined;
}
