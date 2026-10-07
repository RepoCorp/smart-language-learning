import { useState, type ReactElement } from "react";
import DefinitionItemActions from "../itemViews/DefinitionItemActions";
import type { DefinitionViewProps } from "../itemViews/types";
import { useI18n } from "../../../i18n";
import DefinitionStrategiesModal from "../strategies/DefinitionStrategiesModal";
import DefinitionEvaluationsModal from "../evaluations/DefinitionEvaluationsModal";

export default function DefinitionActivities(props: DefinitionViewProps): ReactElement {
  const { language } = useI18n();
  const [open, setOpen] = useState<"strategies" | "evaluations" | null>(null);
  const hasStrategies = props.definition.strategies.length > 0;
  const hasEvaluations = Object.keys(props.definition.evaluations).length > 0;
  return <>
    <DefinitionItemActions language={props.interfaceLanguage ?? language}
      onOpenStrategies={hasStrategies ? () => setOpen("strategies") : undefined}
      onOpenEvaluations={hasEvaluations ? () => setOpen("evaluations") : undefined} />
    {open === "strategies" && hasStrategies && <DefinitionStrategiesModal {...props} onClose={() => setOpen(null)} />}
    {open === "evaluations" && hasEvaluations && <DefinitionEvaluationsModal {...props} onClose={() => setOpen(null)} />}
  </>;
}
