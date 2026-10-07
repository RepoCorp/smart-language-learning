import type { ReactElement } from "react";
import { useI18n } from "../../../../i18n";
import { locales } from "../../locales";
import type { AffixPatternViewProps } from "./AffixPatternView";
import "./AffixPatternView.css";

export default function AffixExamples({ definition, sourceLanguage, interfaceLanguage, limit }: AffixPatternViewProps & {
  limit?: number;
}): ReactElement {
  const { language: appLanguage } = useI18n();
  const language = interfaceLanguage ?? appLanguage;
  if (definition.examples.some(example => !example.translations[sourceLanguage])) {
    return <p role="alert">{locales[language].unavailableTranslation}</p>;
  }
  const affix = definition.affix.replace(/^-|-$/g, "");
  return <section className="affix-pattern-view__examples-section" aria-label={locales[language].examples}>
    <h3>{locales[language].examples}</h3>
    <ul className="affix-pattern-view__examples">
      {definition.examples.slice(0, limit).map((example, index) => {
        const translation = example.translations[sourceLanguage]!;
        const matches = affix.length > 0 && (definition.position === "prefix"
          ? example.result.toLowerCase().startsWith(affix.toLowerCase())
          : example.result.toLowerCase().endsWith(affix.toLowerCase()));
        const start = definition.position === "prefix" ? 0 : example.result.length - affix.length;
        return <li key={`${example.base}:${example.result}:${index}`}>
          <p>{example.base} → {matches ? <>
            {example.result.slice(0, start)}<strong>{example.result.slice(start, start + affix.length)}</strong>{example.result.slice(start + affix.length)}
          </> : example.result}</p>
          <p className="affix-pattern-view__translation">{translation.base} → {translation.result}</p>
        </li>;
      })}
    </ul>
  </section>;
}
