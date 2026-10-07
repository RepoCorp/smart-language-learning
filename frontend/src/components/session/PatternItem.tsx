import { useState } from "react";
import { useI18n } from "../../i18n";
import { useStudyLanguages } from "../../studyLanguages";
import { wordFormationPattern } from "../../languageFeatures/wordFormation";
import type { SessionItem } from "../../types";
import "../strategies/WordFormationPatterns.css";
import ItemViewShell from "../itemView/ItemViewShell";

export default function PatternItem({ item, onContinue, continueLabel, readOnly = false, onClose }: {
  item: SessionItem;
  onContinue?: () => Promise<void>;
  continueLabel?: string;
  readOnly?: boolean;
  onClose?: () => void;
}): JSX.Element {
  const { t } = useI18n();
  const { targetLanguage } = useStudyLanguages();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const pattern = wordFormationPattern(targetLanguage, item.pattern_key || "");
  const construction = item.exercise_phrases?.generation_mode === "construction_pattern";
  const confirm = async () => {
    setSaving(true);
    setError(false);
    try { await onContinue?.(); } catch { setError(true); } finally { setSaving(false); }
  };
  return <ItemViewShell className="word-formation-patterns" onClose={onClose} closeLabel={t("words.close")}>
    <h2>{item.german_text}</h2>
    {construction && <><p>{item.notes}</p><p>{item.example_sentence}</p></>}
    {pattern && <p>{t(pattern.note)}</p>}
    {(item.pattern_examples || []).map(example => {
      const [start, end] = example.highlight;
      return <div className="word-formation-card" key={example.answer}>
        <p>{example.base} → {example.answer.slice(0, start)}<strong>{example.answer.slice(start, end)}</strong>{example.answer.slice(end)}</p>
        <p className="muted">{example.base_translation} → {example.meaning}</p>
      </div>;
    })}
    {error && <p role="alert">{t("wordFormation.reviewFailed")}</p>}
    {!readOnly && onContinue && <button type="button" disabled={saving} onClick={() => void confirm()}>
      {saving ? t("newItem.saving") : continueLabel || t("newItem.gotIt")}
    </button>}
  </ItemViewShell>;
}
