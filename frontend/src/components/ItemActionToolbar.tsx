import type { ReactElement } from "react";
import { useI18n } from "../i18n";
import ItemActionIcon from "./itemView/ItemActionIcon";
import ItemActions from "./itemView/ItemActions";
import type { ItemActionGroup, ItemActionTooltipEvent } from "./itemView/actions";

type Props = {
  itemType: "word" | "phrase";
  loadingExercises: boolean;
  showMobileActionLabels: boolean;
  hasQuestions: boolean;
  hasCompareWordsContent: boolean;
  onOpenExercises: () => void;
  onOpenTesting: () => void;
  onOpenRelatedDialogs: () => void;
  onOpenQuestions: () => void;
  onOpenCompareWords: () => void;
  onOpenAdminActions: () => void;
  onShowTooltip: (event: ItemActionTooltipEvent, label: string) => void;
  onHideTooltip: () => void;
};

export default function ItemActionToolbar(props: Props): ReactElement {
  const { t } = useI18n();
  const groups: ItemActionGroup[] = [
    { id: "practice", label: t("newItem.actionGroupPractice"), tone: "primary", actions: [
      { id: "strategies", label: t("newItem.openStrategies"), icon: <ItemActionIcon name="exercise" />,
        onClick: props.onOpenExercises, disabled: props.loadingExercises },
      { id: "testing", label: t("newItem.openTesting"), icon: <ItemActionIcon name="test" />,
        onClick: props.onOpenTesting, disabled: props.loadingExercises },
    ] },
    { id: "explore", label: t("newItem.actionGroupExplore"), actions: [
      { id: "dialogs", label: t("newItem.openRelatedDialogs"), icon: <ItemActionIcon name="dialogs" />, onClick: props.onOpenRelatedDialogs },
      { id: "questions", label: t("newItem.openQuestions"), icon: <ItemActionIcon name="questions" />,
        onClick: props.onOpenQuestions, hasContent: props.hasQuestions },
      ...(props.itemType === "word" ? [{
        id: "compare", label: t("newItem.openCompareWords"), icon: <ItemActionIcon name="compareWords" />,
        onClick: props.onOpenCompareWords, hasContent: props.hasCompareWordsContent,
      }] : []),
    ] },
    { id: "danger", label: t("newItem.actionGroupDanger"), tone: "danger", actions: [
      { id: "admin", label: t("newItem.actionGroupDanger"), icon: <ItemActionIcon name="admin" />, onClick: props.onOpenAdminActions },
    ] },
  ];
  return <ItemActions groups={groups} showMobileActionLabels={props.showMobileActionLabels}
    onShowTooltip={props.onShowTooltip} onHideTooltip={props.onHideTooltip} />;
}
