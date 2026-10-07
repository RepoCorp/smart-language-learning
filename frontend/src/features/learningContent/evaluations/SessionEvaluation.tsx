import type { ReactElement } from "react";
import { useI18n } from "../../../i18n";
import { locales } from "../locales";
import { getEvaluation } from "./registry";
import type { SessionEvaluationProps } from "./sessionTypes";

export default function SessionEvaluation(props: SessionEvaluationProps): ReactElement {
  const { language } = useI18n();
  const evaluation = getEvaluation(props.payload.id);
  return evaluation ? <evaluation.SessionView {...props} />
    : <p role="alert">{locales[language].unavailableEvaluation}</p>;
}
