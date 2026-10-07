import type { ReactElement } from "react";
import { useI18n } from "../../../i18n";
import { locales } from "../locales";
import type { AffixPatternViewProps } from "../patterns/affix/AffixPatternView";
import { getItemView } from "./registry";
import ItemViewShell from "../../../components/itemView/ItemViewShell";
import ItemActions from "../../../components/itemView/ItemActions";
import type { ItemActionsProps } from "../../../components/itemView/actions";
import DefinitionActivities from "./DefinitionActivities";

export default function ItemView({ onClose, actions, ...props }: AffixPatternViewProps & {
  onClose?: () => void;
  actions?: ItemActionsProps;
}): ReactElement {
  const { language: appLanguage } = useI18n();
  const language = props.interfaceLanguage ?? appLanguage;
  const View = getItemView(props.definition.item_view);
  return <ItemViewShell onClose={onClose} closeLabel={locales[language].close}
    actions={View ? (actions ? <ItemActions {...actions} /> : <DefinitionActivities key={props.definition.key} {...props} />) : undefined}>
    {View ? <View {...props} /> : <p role="alert">{locales[language].unavailableView}</p>}
  </ItemViewShell>;
}
