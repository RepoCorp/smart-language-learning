import { useRef, useState, type ReactNode } from "react";
import { useI18n } from "../../i18n";
import type { SessionItem } from "../../types";
import PracticeRuleNote from "./PracticeRuleNote";

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
  if (!item.pattern_exercise) return <p role="alert">{t("wordFormation.reviewFailed")}</p>;
  const { base, base_translation, question, answer, meaning, highlight: [start, end] } = item.pattern_exercise;
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
    <p><b>{base}</b> — <span>{base_translation}</span></p>
    <p>{question}</p>
    {(revealed || completed) && <p className="word-formation-match">{recognition ? meaning
      : <>{answer.slice(0, start)}<strong>{answer.slice(start, end)}</strong>{answer.slice(end)}</>}</p>}
    {(revealed || completed) && <PracticeRuleNote patternKey={item.pattern_key} />}
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
