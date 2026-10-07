import AffixPatternView from "../patterns/affix/AffixPatternView";
import { isAffixPatternDefinition } from "../patterns/affix/definition";
import WordView from "../words/WordView";
import { isWordDefinition } from "../words/definition";
import PhraseView from "../phrases/PhraseView";
import { isPhraseDefinition } from "../phrases/definition";
import { withDefinition } from "./withDefinition";

const itemViews = {
  affix_pattern: withDefinition(isAffixPatternDefinition, AffixPatternView),
  word: withDefinition(isWordDefinition, WordView),
  phrase: withDefinition(isPhraseDefinition, PhraseView),
};

export function getItemView(id: string): (typeof itemViews)[keyof typeof itemViews] | undefined {
  return Object.prototype.hasOwnProperty.call(itemViews, id) ? itemViews[id as keyof typeof itemViews] : undefined;
}
