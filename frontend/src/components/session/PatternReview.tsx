import { useRef, useState, type ReactNode } from "react";
import { useI18n } from "../../i18n";
import type { SessionItem } from "../../types";
import PracticeRuleNote from "./PracticeRuleNote";
import ConstructionPatternRecall from "./ConstructionPatternRecall";

export default function PatternReview({ item, completed, disabled, onAnswered, onNext, postReviewActions }: {
  item: SessionItem;
  completed: boolean;
  disabled: boolean;
  onAnswered: (correct: boolean) => Promise<void>;
  onNext: () => void;
  postReviewActions?: ReactNode;
}): JSX.Element {
  const { t } = useI18n();
  const [revealed, setRevealed] = useState(completed);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const inFlight = useRef(false);
  const construction = item.exercise_phrases?.generation_mode === "construction_pattern";
  if (!construction && !item.pattern_exercise) return <p role="alert">{t("wordFormation.reviewFailed")}</p>;
  const recognition = item.direction === "de_to_es";
  const review = async (correct: boolean): Promise<void> => {
    if (inFlight.current || completed || disabled || !revealed) return;
    inFlight.current = true;
    setSaving(true);
    setError(false);
    try {
      await onAnswered(correct);
    } catch {
      setError(true);
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };
  return <div className="pattern-review">
    {construction ? <ConstructionPatternRecall item={item} revealed={revealed || completed} />
      : item.pattern_exercise && <>
        <p><b>{item.pattern_exercise.base}</b> — <span>{item.pattern_exercise.base_translation}</span></p>
        <p>{item.pattern_exercise.question}</p>
        {(revealed || completed) && <p className="word-formation-match">{recognition ? item.pattern_exercise.meaning
          : <>{item.pattern_exercise.answer.slice(0, item.pattern_exercise.highlight[0])}<strong>{item.pattern_exercise.answer.slice(...item.pattern_exercise.highlight)}</strong>{item.pattern_exercise.answer.slice(item.pattern_exercise.highlight[1])}</>}</p>}
        {(revealed || completed) && <PracticeRuleNote patternKey={item.pattern_key} />}
      </>}
    {error && <p role="alert" className="error">{t("wordFormation.reviewFailed")}</p>}
    <div className="actions">
      {completed ? <button type="button" disabled={disabled} onClick={onNext}>{t("session.nextItem")}</button>
        : !revealed ? <button type="button" disabled={disabled} onClick={() => setRevealed(true)}>{t("review.revealAnswer")}</button>
        : <>
          <button type="button" disabled={saving || disabled} onClick={() => void review(true)}>{t("review.passed")}</button>
          <button type="button" className="dangerous-action-button" disabled={saving || disabled} onClick={() => void review(false)}>{t("review.failed")}</button>
        </>}
      {completed && postReviewActions}
    </div>
  </div>;
}
