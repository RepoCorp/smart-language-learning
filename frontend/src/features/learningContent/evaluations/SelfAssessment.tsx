import { useRef, useState, type ReactElement, type ReactNode } from "react";
import type { AppLanguage } from "../../../i18n";
import { locales } from "../locales";
import "./evaluations.css";

export default function SelfAssessment({ prompt, answer, language, onNext, onAnswered, completed: restored = false,
  disabled = false, nextLabel, postReviewActions, answerDetails }: {
  prompt: ReactNode;
  answer: ReactNode;
  language: AppLanguage;
  onNext: () => void;
  onAnswered?: (correct: boolean) => Promise<void>;
  completed?: boolean;
  disabled?: boolean;
  nextLabel?: string;
  postReviewActions?: ReactNode;
  answerDetails?: ReactNode;
}): ReactElement {
  const [stage, setStage] = useState<"hidden" | "revealed" | "passed" | "failed">("hidden");
  const text = locales[language];
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const inFlight = useRef(false);
  const scored = stage === "passed" || stage === "failed";
  const completed = restored || scored;
  const score = async (correct: boolean): Promise<void> => {
    if (inFlight.current || completed || disabled || stage !== "revealed") return;
    if (!onAnswered) {
      setStage(correct ? "passed" : "failed");
      return;
    }
    inFlight.current = true;
    setSaving(true);
    setError(false);
    try {
      await onAnswered(correct);
      setStage(correct ? "passed" : "failed");
    } catch {
      setError(true);
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };
  return <section className="definition-evaluation">
    <div className="definition-evaluation-prompt">{prompt}</div>
    {(stage !== "hidden" || completed) && <div className="definition-evaluation-answer">{answer}</div>}
    {(stage !== "hidden" || completed) && answerDetails}
    {error && <p role="alert" className="error">{text.evaluationSaveFailed}</p>}
    <div className="actions">
      {!completed && stage === "hidden" && <button type="button" disabled={disabled} onClick={() => setStage("revealed")}>{text.revealAnswer}</button>}
      {!completed && stage === "revealed" && <>
        <button type="button" disabled={disabled || saving} onClick={() => void score(true)}>{text.passed}</button>
        <button type="button" disabled={disabled || saving} onClick={() => void score(false)}>{text.failed}</button>
      </>}
      {completed && <>
        <button type="button" disabled={disabled || saving} onClick={onNext}>{nextLabel ?? text.nextExample}</button>
        {postReviewActions}
      </>}
    </div>
    {scored && <p role="status">{text[stage]}</p>}
  </section>;
}
