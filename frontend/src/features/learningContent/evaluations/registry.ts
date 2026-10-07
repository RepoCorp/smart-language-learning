import AffixProductionEvaluation from "../patterns/affix/AffixProductionEvaluation";
import AffixProductionSession from "../patterns/affix/AffixProductionSession";

const evaluations = {
  affix_production: { View: AffixProductionEvaluation, SessionView: AffixProductionSession, label: "buildWord" as const },
};

export function getEvaluation(id: string): (typeof evaluations)[keyof typeof evaluations] | undefined {
  return Object.prototype.hasOwnProperty.call(evaluations, id) ? evaluations[id as keyof typeof evaluations] : undefined;
}
