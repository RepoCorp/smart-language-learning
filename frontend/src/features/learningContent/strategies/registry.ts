import AffixExamples from "../patterns/affix/AffixExamples";
import BankWords from "./bankWords/BankWords";
import { isAffixPatternDefinition } from "../patterns/affix/definition";
import { withDefinition } from "../itemViews/withDefinition";

const strategies = {
  affix_examples: { label: "examples" as const, View: withDefinition(isAffixPatternDefinition, AffixExamples) },
  affix_bank_words: { label: "yourWords" as const, View: BankWords },
};

export function getStrategy(id: string): (typeof strategies)[keyof typeof strategies] | undefined {
  return Object.prototype.hasOwnProperty.call(strategies, id) ? strategies[id as keyof typeof strategies] : undefined;
}
