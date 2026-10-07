import type { ComponentProps, ReactElement } from "react";
import { locales } from "../../locales";
import EvaluationQuestion from "../../evaluations/EvaluationQuestion";
import SelfAssessment from "../../evaluations/SelfAssessment";
import type { AffixProductionData } from "./production";

export default function AffixProductionContent({ data, ...assessment }: Omit<ComponentProps<typeof SelfAssessment>, "prompt" | "answer"> & {
  data: AffixProductionData;
}): ReactElement {
  const [start, end] = data.highlight;
  const promptValues = {
    "{base}": <strong>{data.base}</strong>,
    "{translation}": data.base_translation,
    "{meaning}": data.meaning,
  };
  return <SelfAssessment {...assessment}
    prompt={<EvaluationQuestion template={locales[assessment.language].affixProductionPrompt} values={promptValues} />}
    answer={<p>{data.answer.slice(0, start)}<strong>{data.answer.slice(start, end)}</strong>{data.answer.slice(end)}</p>} />;
}
