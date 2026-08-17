import type { SessionItem } from "../../types";
import PhraseReview from "../PhraseReview";
import WordPartsReview from "../WordPartsReview";
import WordReview from "../WordReview";
import ItemTestingModal from "./ItemTestingModal";
import type { ItemTestingModalController } from "./useItemTestingModal";

type ItemTestingExperienceProps = {
  itemType: "word" | "phrase";
  itemId: number;
  sourceText: string;
  targetText: string;
  relatedDialogsCount: number;
  wordIntroPracticeItem: SessionItem;
  wordLetterPracticeItem: SessionItem;
  wordPartsPracticeItem: SessionItem;
  phraseBuilderItem: SessionItem;
  directTestItem: SessionItem;
  controller: ItemTestingModalController;
};

export default function ItemTestingExperience({
  itemType,
  itemId,
  sourceText,
  targetText,
  relatedDialogsCount,
  wordIntroPracticeItem,
  wordLetterPracticeItem,
  wordPartsPracticeItem,
  phraseBuilderItem,
  directTestItem,
  controller,
}: ItemTestingExperienceProps): JSX.Element | null {
  if (!controller.isOpen) {
    return null;
  }

  const actionKey = controller.selectedActionKey;
  const practiceKey = `${itemId}-${sourceText}-${targetText}-${actionKey}`;

  return (
    <ItemTestingModal
      itemType={itemType}
      selectedActionKey={actionKey}
      onSelectedActionKeyChange={controller.selectAction}
      onClose={controller.close}
      testingContent={
        actionKey === "warmup" && itemType === "word" ? (
          <WordReview
            key={`testing-word-intro-practice-${practiceKey}`}
            item={wordIntroPracticeItem}
            onAnswered={async () => controller.completePractice()}
          />
        ) : actionKey === "letters" && itemType === "word" ? (
          <WordReview
            key={`testing-word-letter-practice-${practiceKey}`}
            item={wordLetterPracticeItem}
            onAnswered={async () => controller.completePractice()}
          />
        ) : actionKey === "parts" && itemType === "word" ? (
          <WordPartsReview
            key={`testing-word-parts-practice-${practiceKey}`}
            item={wordPartsPracticeItem}
            onAnswered={async () => controller.completePractice()}
          />
        ) : actionKey === "builder" && itemType === "phrase" ? (
          <PhraseReview
            key={`testing-phrase-builder-${practiceKey}`}
            item={phraseBuilderItem}
            onAnswered={async () => controller.completePractice()}
          />
        ) : itemType === "word" ? (
          <WordReview
            key={`testing-direct-word-test-${itemId}-${sourceText}-${targetText}-${relatedDialogsCount}-${controller.directTestResetVersion}`}
            item={directTestItem}
            onAnswered={controller.registerDirectTestAnswer}
            reviewComplete={controller.directTestReviewComplete}
            onNextItem={async () => controller.close()}
          />
        ) : (
          <PhraseReview
            key={`testing-direct-phrase-test-${itemId}-${sourceText}-${targetText}-${controller.directTestResetVersion}`}
            item={directTestItem}
            onAnswered={controller.registerDirectTestAnswer}
            reviewComplete={controller.directTestReviewComplete}
            onNextItem={async () => controller.close()}
          />
        )
      }
    />
  );
}
