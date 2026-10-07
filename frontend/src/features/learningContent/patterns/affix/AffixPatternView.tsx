import type { ReactElement } from "react";
import { useI18n, type AppLanguage } from "../../../../i18n";
import ItemViewHeader from "../../../../components/ItemViewHeader";
import { ItemHeading, ItemTitle } from "../../../../components/itemView/ItemHeading";
import { ItemMetadata, ItemType, ItemTypeDescription, ItemNotes } from "../../../../components/itemView/ItemMetadata";
import { locales } from "../../locales";
import type { AffixPatternDefinition } from "./definition";
import AffixExamples from "./AffixExamples";
import "./AffixPatternView.css";

export interface AffixPatternViewProps {
  definition: AffixPatternDefinition;
  sourceLanguage: string;
  interfaceLanguage?: AppLanguage;
}

export default function AffixPatternView({ definition, sourceLanguage, interfaceLanguage }: AffixPatternViewProps): ReactElement {
  const { language: appLanguage } = useI18n();
  const language = interfaceLanguage ?? appLanguage;
  const display = definition.display[language];
  if (!display || definition.examples.some(example => !example.translations[sourceLanguage])) {
    return <p role="alert">{locales[language].unavailableTranslation}</p>;
  }
  return <section className="affix-pattern-view" aria-label={display.title}>
    <ItemViewHeader>
      <ItemHeading><ItemTitle>{display.title}</ItemTitle></ItemHeading>
      <ItemMetadata>
        <ItemType label={locales[language].type}
          description={<ItemTypeDescription>{locales[language].wordBuilding}</ItemTypeDescription>}>
          {locales[language].languagePattern}
        </ItemType>
        <ItemNotes label={locales[language].notes}>{display.explanation}</ItemNotes>
      </ItemMetadata>
    </ItemViewHeader>
    <AffixExamples definition={definition} sourceLanguage={sourceLanguage} interfaceLanguage={language} limit={2} />
  </section>;
}
