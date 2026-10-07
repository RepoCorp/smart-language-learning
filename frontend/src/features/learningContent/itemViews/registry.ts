import AffixPatternView from "../patterns/affix/AffixPatternView";

const itemViews = {
  affix_pattern: AffixPatternView,
};

export function getItemView(id: string): typeof AffixPatternView | undefined {
  return Object.prototype.hasOwnProperty.call(itemViews, id) ? itemViews[id as keyof typeof itemViews] : undefined;
}
