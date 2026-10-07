import type { ReactElement } from "react";
import ItemViewHeader from "../../../components/ItemViewHeader";
import { ItemHeading, ItemTitle, ItemSubtitle } from "../../../components/itemView/ItemHeading";
import { ItemMetadata, ItemType, ItemTypeDescription, ItemNotes } from "../../../components/itemView/ItemMetadata";
import { useI18n } from "../../../i18n";
import type { DefinitionViewProps } from "../itemViews/types";
import { locales } from "../locales";
import type { WordDefinition } from "./definition";

export default function WordView({ definition, sourceLanguage, interfaceLanguage }: DefinitionViewProps<WordDefinition>): ReactElement {
  const { language: appLanguage } = useI18n();
  const language = interfaceLanguage ?? appLanguage;
  const labels = locales[language];
  const display = definition.display[language];
  const translation = definition.translations[sourceLanguage];
  if (!display || typeof translation !== "string" || !translation.trim()) {
    return <p role="alert">{labels.unavailableTranslation}</p>;
  }
  if (!Object.prototype.hasOwnProperty.call(labels.wordTypes, definition.word_type)) {
    return <p role="alert">{labels.unavailableView}</p>;
  }
  const wordType = labels.wordTypes[definition.word_type as keyof typeof labels.wordTypes];

  return <section className="word-item-view" aria-label={definition.text}>
    <ItemViewHeader>
      <ItemHeading>
        <ItemTitle>{definition.gender
          ? <span className={`gender-word-mark gender-word-${definition.gender}`}>{definition.text}</span>
          : definition.text}</ItemTitle>
        <ItemSubtitle>{translation}</ItemSubtitle>
      </ItemHeading>
      <ItemMetadata>
        <ItemType label={labels.type} description={<ItemTypeDescription>{wordType}</ItemTypeDescription>}>
          {labels.word}
        </ItemType>
        {display.explanation.trim() && <ItemNotes label={labels.notes}>{display.explanation}</ItemNotes>}
      </ItemMetadata>
    </ItemViewHeader>
  </section>;
}
