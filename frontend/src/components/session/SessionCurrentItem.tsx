import type { ReactNode } from "react";

import type { SessionItem } from "../../types";
import LegacyItemView from "../LegacyItemView";
import PhraseReview from "../PhraseReview";
import WordPartsReview from "../WordPartsReview";
import WordReview from "../WordReview";
import PatternReview from "./PatternReview";
import PracticeRuleNote from "./PracticeRuleNote";
import SessionEvaluation from "../../features/learningContent/evaluations/SessionEvaluation";

type SessionCurrentItemProps = {
  item: SessionItem;
  renderKey: string;
  reviewComplete: boolean;
  onNewItemContinue: () => Promise<void>;
  onReviewAnswered: (correct: boolean) => Promise<void>;
  onNextItem: () => Promise<void>;
  postReviewActions?: ReactNode;
  disabled?: boolean;
};

export default function SessionCurrentItem(props: SessionCurrentItemProps): JSX.Element {
  const { item } = props;
  return <>
    {item.mode === "review" && item.repeatedAfterFailure && item.repeatPracticeStep && (
      <PracticeRuleNote grammarFeatureKeys={item.practice_grammar_feature_keys} />
    )}
    <CurrentItemExercise {...props} />
  </>;
}

function CurrentItemExercise({
  item,
  renderKey,
  reviewComplete,
  onNewItemContinue,
  onReviewAnswered,
  onNextItem,
  postReviewActions,
  disabled = false,
}: SessionCurrentItemProps): JSX.Element {
  if (item.mode === "new") {
    return <LegacyItemView key={renderKey} item={item} onContinue={onNewItemContinue} />;
  }

  if (item.learning_evaluation) {
    return <SessionEvaluation key={renderKey} payload={item.learning_evaluation} completed={reviewComplete} disabled={disabled}
      onAnswered={onReviewAnswered} onNext={onNextItem} postReviewActions={postReviewActions}
      answerDetails={<PracticeRuleNote patternKey={item.pattern_key} />} />;
  }

  if (item.item_type === "pattern") {
    return <PatternReview key={renderKey} item={item} completed={reviewComplete} disabled={disabled}
      onAnswered={onReviewAnswered} onNext={onNextItem} postReviewActions={postReviewActions} />;
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
