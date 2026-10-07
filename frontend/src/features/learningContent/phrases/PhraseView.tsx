import type { ReactElement } from "react";
import ItemViewHeader from "../../../components/ItemViewHeader";
import { ItemHeading, ItemTitle, ItemSubtitle } from "../../../components/itemView/ItemHeading";
import { ItemMetadata, ItemType, ItemNotes } from "../../../components/itemView/ItemMetadata";
import { useI18n } from "../../../i18n";
import type { DefinitionViewProps } from "../itemViews/types";
import { locales } from "../locales";
import type { PhraseDefinition } from "./definition";

export default function PhraseView({ definition, sourceLanguage, interfaceLanguage }: DefinitionViewProps<PhraseDefinition>): ReactElement {
  const { language: appLanguage } = useI18n();
  const language = interfaceLanguage ?? appLanguage;
  const labels = locales[language];
  const display = definition.display[language];
  const translation = definition.translations[sourceLanguage];
  if (!display || typeof translation !== "string" || !translation.trim()) {
    return <p role="alert">{labels.unavailableTranslation}</p>;
  }

  return <section className="phrase-item-view" aria-label={definition.text}>
    <ItemViewHeader>
      <ItemHeading>
        <ItemTitle>{definition.text}</ItemTitle>
        <ItemSubtitle>{translation}</ItemSubtitle>
      </ItemHeading>
      <ItemMetadata>
        <ItemType label={labels.type}>{labels.phrase}</ItemType>
        <ItemNotes label={labels.notes}>{display.explanation}</ItemNotes>
      </ItemMetadata>
    </ItemViewHeader>
  </section>;
}
