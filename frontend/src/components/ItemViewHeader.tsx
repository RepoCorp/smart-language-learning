import type { ItemType, StudyLanguageCode } from "../types";
import GenderedNounText, { nounGenderForLanguage, type NounGender } from "./GenderedNounText";

function nounTitleForLanguage(
  targetText: string,
  itemType: ItemType,
  wordType: string,
  targetLanguage: StudyLanguageCode,
): { article: string; noun: string; gender: NounGender } | null {
  if (
    itemType !== "word" ||
    !["german", "spanish"].includes(targetLanguage) ||
    wordType.trim().toLowerCase() !== "noun"
  ) {
    return null;
  }

  const match = targetText.trim().match(/^(der|die|das|el|la|los|las)\s+(.+)$/i);
  if (!match) {
    return null;
  }

  const article = match[1];
  const gender = nounGenderForLanguage(targetText, targetLanguage);
  if (!gender) {
    return null;
  }
  return {
    article,
    noun: match[2],
    gender,
  };
}

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

export default function ItemViewHeader({
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
}: ItemViewHeaderProps): JSX.Element {
  const nounTitle = nounTitleForLanguage(targetText, itemType, wordType, targetLanguage);

  return (
    <>
      <section className="item-view-header-card">
        <div className="item-view-title-row">
          <div className="item-view-title-block">
            <h2 className="item-view-title">
              {nounTitle ? (
                <GenderedNounText text={`${nounTitle.article} ${nounTitle.noun}`} targetText={targetText} targetLanguage={targetLanguage} gender={nounTitle.gender} />
              ) : (
                targetText || sourceText
              )}
            </h2>
            <p className="item-view-subtitle">{sourceText}</p>
          </div>
        </div>
        <div className="item-view-meta-grid">
          {itemType === "word" && (
            <div className="item-view-meta-card">
              <span className="item-view-meta-label">{wordTypeLabel}</span>
              <strong className="item-view-meta-value">
                {wordType || unknownWordTypeLabel}
              </strong>
            </div>
          )}
          <div className="item-view-meta-card">
            <span className="item-view-meta-label">{notesLabel}</span>
            <strong className="item-view-meta-value item-view-meta-value-notes">
              {notes || "-"}
            </strong>
          </div>
        </div>
      </section>
      {audioUrl && (
        <div className="item-view-audio-wrap">
          <audio controls src={audioUrl}>
            {noAudioSupportLabel}
          </audio>
        </div>
      )}
    </>
  );
}
