import type { ComponentProps, ReactElement } from "react";
import { locales } from "../../locales";
import EvaluationQuestion from "../../evaluations/EvaluationQuestion";
import SelfAssessment from "../../evaluations/SelfAssessment";
import type { AffixRecognitionData } from "./recognition";

export default function AffixRecognitionContent({ data, ...assessment }: Omit<ComponentProps<typeof SelfAssessment>, "prompt" | "answer"> & {
  data: AffixRecognitionData;
}): ReactElement {
  return <SelfAssessment {...assessment}
    prompt={<EvaluationQuestion template={locales[assessment.language].affixRecognitionPrompt} values={{
      "{base}": <strong>{data.base}</strong>,
      "{translation}": data.base_translation,
      "{word}": <strong>{data.word}</strong>,
    }} />}
    answer={<p>{data.answer}</p>} />;
}
