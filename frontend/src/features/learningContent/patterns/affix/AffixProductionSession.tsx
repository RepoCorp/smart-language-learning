import type { ReactElement } from "react";
import { useI18n } from "../../../../i18n";
import { locales } from "../../locales";
import type { SessionEvaluationProps } from "../../evaluations/sessionTypes";
import AffixProductionContent from "./AffixProductionContent";
import { isAffixProductionData } from "./production";

export default function AffixProductionSession({ payload, ...assessment }: SessionEvaluationProps): ReactElement {
  const { language, t } = useI18n();
  if (!isAffixProductionData(payload.content)) return <p role="alert">{locales[language].unavailableEvaluation}</p>;
  return <AffixProductionContent {...assessment} data={payload.content} language={language} nextLabel={t("session.nextItem")} />;
}
