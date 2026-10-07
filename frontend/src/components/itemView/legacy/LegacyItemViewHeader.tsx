import type { ReactElement } from "react";
import type { ItemType, StudyLanguageCode } from "../../../types";
import { nounTitleForLanguage } from "../../../languageFeatures/nouns/title";
import GenderedNounText from "../../GenderedNounText";
import ItemViewHeader from "../../ItemViewHeader";
import { ItemHeading, ItemTitle, ItemSubtitle } from "../ItemHeading";
import { ItemMetadata, ItemType as ItemTypeField, ItemNotes } from "../ItemMetadata";

type ItemViewHeaderProps = {
  itemType: ItemType;
  targetText: string;
  sourceText: string;
  wordType: string;
  notes: string;
  audioUrl: string;
  targetLanguage: StudyLanguageCode;
  wordTypeLabel: string;
  unknownWordTypeLabel: string;
  notesLabel: string;
  noAudioSupportLabel: string;
};

export default function LegacyItemViewHeader({
  itemType,
  targetText,
  sourceText,
  wordType,
  notes,
  audioUrl,
  targetLanguage,
  wordTypeLabel,
  unknownWordTypeLabel,
  notesLabel,
  noAudioSupportLabel,
}: ItemViewHeaderProps): ReactElement {
  const nounTitle = itemType === "word" && wordType.trim().toLowerCase() === "noun"
    ? nounTitleForLanguage(targetText, targetLanguage)
    : null;

  return (
    <ItemViewHeader audio={{ url: audioUrl, unavailableLabel: noAudioSupportLabel }}>
      <ItemHeading>
        <ItemTitle>{nounTitle ? (
          <GenderedNounText text={`${nounTitle.article} ${nounTitle.noun}`} targetText={targetText} targetLanguage={targetLanguage} gender={nounTitle.gender} />
        ) : targetText || sourceText}</ItemTitle>
        <ItemSubtitle>{sourceText}</ItemSubtitle>
      </ItemHeading>
      <ItemMetadata>
        {itemType === "word" && <ItemTypeField label={wordTypeLabel}>{wordType || unknownWordTypeLabel}</ItemTypeField>}
        <ItemNotes label={notesLabel}>{notes || "-"}</ItemNotes>
      </ItemMetadata>
    </ItemViewHeader>
  );
}
