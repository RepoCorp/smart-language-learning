import AffixExamples from "../patterns/affix/AffixExamples";

const strategies = {
  affix_examples: { label: "examples" as const, View: AffixExamples },
};

export function getStrategy(id: string): typeof strategies.affix_examples | undefined {
  return Object.prototype.hasOwnProperty.call(strategies, id) ? strategies[id as keyof typeof strategies] : undefined;
}
