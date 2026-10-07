import type { ReactElement } from "react";
import type { AppLanguage } from "../../../i18n";
import { usePromptPreferences } from "../../../promptPreferences";
import ItemActions from "../../../components/itemView/ItemActions";
import ItemActionIcon from "../../../components/itemView/ItemActionIcon";
import { locales } from "../locales";

export default function DefinitionItemActions({ language, onOpenStrategies, onOpenEvaluations }: {
  language: AppLanguage;
  onOpenStrategies?: () => void;
  onOpenEvaluations?: () => void;
}): ReactElement {
  const labels = locales[language].actions;
  const { showMobileActionLabels } = usePromptPreferences();
  const inactive = { disabled: true, onClick: () => {} };
  return <ItemActions showMobileActionLabels={showMobileActionLabels} groups={[
    { id: "practice", label: labels.practice, tone: "primary", actions: [
      { id: "strategies", label: labels.strategies, icon: <ItemActionIcon name="exercise" />,
        disabled: !onOpenStrategies, onClick: onOpenStrategies ?? inactive.onClick },
      { id: "testing", label: labels.testing, icon: <ItemActionIcon name="test" />,
        disabled: !onOpenEvaluations, onClick: onOpenEvaluations ?? inactive.onClick },
    ] },
    { id: "explore", label: labels.explore, actions: [
      { ...inactive, id: "dialogs", label: labels.dialogs, icon: <ItemActionIcon name="dialogs" /> },
      { ...inactive, id: "questions", label: labels.questions, icon: <ItemActionIcon name="questions" /> },
    ] },
    { id: "danger", label: labels.danger, tone: "danger", actions: [
      { ...inactive, id: "admin", label: labels.danger, icon: <ItemActionIcon name="admin" /> },
    ] },
  ]} />;
}
