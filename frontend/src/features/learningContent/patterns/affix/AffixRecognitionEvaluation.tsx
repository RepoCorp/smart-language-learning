import { useState, type ReactElement } from "react";
import { useI18n } from "../../../../i18n";
import { locales } from "../../locales";
import AffixRecognitionContent from "./AffixRecognitionContent";
import { prepareAffixRecognition } from "./recognition";
import type { AffixPatternViewProps } from "./AffixPatternView";

export default function AffixRecognitionEvaluation({ definition, sourceLanguage, interfaceLanguage }: AffixPatternViewProps): ReactElement {
  const { language: appLanguage } = useI18n();
  const language = interfaceLanguage ?? appLanguage;
  const [index, setIndex] = useState(0);
  const data = prepareAffixRecognition(definition.examples[index], sourceLanguage);
  if (!data) return <p role="alert">{locales[language].unavailableTranslation}</p>;
  return <AffixRecognitionContent key={`${definition.key}:${sourceLanguage}:${index}`} language={language} data={data}
    onNext={() => setIndex(current => (current + 1) % definition.examples.length)} />;
}
