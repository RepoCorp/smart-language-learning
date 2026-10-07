import { useState, type ReactElement } from "react";
import { useI18n } from "../../../../i18n";
import { locales } from "../../locales";
import AffixProductionContent from "./AffixProductionContent";
import { prepareAffixProduction } from "./production";
import type { AffixPatternViewProps } from "./AffixPatternView";

export default function AffixProductionEvaluation({ definition, sourceLanguage, interfaceLanguage }: AffixPatternViewProps): ReactElement {
  const { language: appLanguage } = useI18n();
  const language = interfaceLanguage ?? appLanguage;
  const text = locales[language];
  const [index, setIndex] = useState(0);
  const data = prepareAffixProduction(definition, definition.examples[index], sourceLanguage);
  if (!data) return <p role="alert">{text.unavailableTranslation}</p>;
  return <AffixProductionContent key={`${definition.key}:${sourceLanguage}:${index}`} language={language} data={data}
    onNext={() => setIndex(current => (current + 1) % definition.examples.length)} />;
}
