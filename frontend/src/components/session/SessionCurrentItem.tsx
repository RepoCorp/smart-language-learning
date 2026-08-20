import type { ReactNode } from "react";

import type { SessionItem } from "../../types";
import NewItem from "../NewItem";
import PhraseReview from "../PhraseReview";
import WordPartsReview from "../WordPartsReview";
import WordReview from "../WordReview";

type SessionCurrentItemProps = {
  item: SessionItem;
  renderKey: string;
  reviewComplete: boolean;
  onNewItemContinue: () => Promise<void>;
  onReviewAnswered: (correct: boolean) => Promise<void>;
  onNextItem: () => Promise<void>;
  postReviewActions?: ReactNode;
};

export default function SessionCurrentItem({
  item,
  renderKey,
  reviewComplete,
  onNewItemContinue,
  onReviewAnswered,
  onNextItem,
  postReviewActions,
}: SessionCurrentItemProps): JSX.Element {
  if (item.mode === "new") {
    return <NewItem key={renderKey} item={item} onContinue={onNewItemContinue} />;
  }

  if (item.item_type === "word" && item.repeatPracticeStep === "word_parts") {
    return (
      <WordPartsReview
        key={renderKey}
        item={item}
        onAnswered={onReviewAnswered}
        reviewComplete={reviewComplete}
        onNextItem={onNextItem}
        postReviewActions={postReviewActions}
      />
    );
  }

  if (item.item_type === "word") {
    return (
      <WordReview
        key={renderKey}
        item={item}
        onAnswered={onReviewAnswered}
        reviewComplete={reviewComplete}
        onNextItem={onNextItem}
        postReviewActions={postReviewActions}
      />
    );
  }

  return (
    <PhraseReview
      key={renderKey}
      item={item}
      onAnswered={onReviewAnswered}
      reviewComplete={reviewComplete}
      onNextItem={onNextItem}
      postReviewActions={postReviewActions}
    />
  );
}
