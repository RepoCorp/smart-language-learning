import type { ReactElement } from "react";
import { useI18n } from "../../../../i18n";
import { locales } from "../../locales";
import type { SessionEvaluationProps } from "../../evaluations/sessionTypes";
import AffixRecognitionContent from "./AffixRecognitionContent";
import { isAffixRecognitionData } from "./recognition";

export default function AffixRecognitionSession({ payload, ...assessment }: SessionEvaluationProps): ReactElement {
  const { language, t } = useI18n();
  if (!isAffixRecognitionData(payload.content)) return <p role="alert">{locales[language].unavailableEvaluation}</p>;
  return <AffixRecognitionContent {...assessment} data={payload.content} language={language} nextLabel={t("session.nextItem")} />;
}
