import type { ComponentProps, ReactElement } from "react";
import { locales } from "../../locales";
import SelfAssessment from "../../evaluations/SelfAssessment";
import type { AffixProductionData } from "./production";

export default function AffixProductionContent({ data, ...assessment }: Omit<ComponentProps<typeof SelfAssessment>, "prompt" | "answer"> & {
  data: AffixProductionData;
}): ReactElement {
  const [start, end] = data.highlight;
  return <SelfAssessment {...assessment}
    prompt={<>
      <p><strong>{data.base}</strong> — {data.base_translation}</p>
      <p>{locales[assessment.language].howWouldYouSay} «{data.meaning}»?</p>
    </>}
    answer={<p>{data.answer.slice(0, start)}<strong>{data.answer.slice(start, end)}</strong>{data.answer.slice(end)}</p>} />;
}
