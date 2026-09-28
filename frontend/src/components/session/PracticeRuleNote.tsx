import { useI18n } from "../../i18n";
import { useStudyLanguages } from "../../studyLanguages";
import { wordFormationPattern } from "../../languageFeatures/wordFormation";
import { phraseGrammarFeaturePresentationFor } from "../strategies/phraseGrammarFeatureCatalog";
import type { PhraseGrammarFeatureKey } from "../strategies/phraseGrammarTypes";
import "./PracticeRuleNote.css";

export default function PracticeRuleNote({ grammarFeatureKeys = [], patternKey }: {
  grammarFeatureKeys?: string[];
  patternKey?: string;
}): JSX.Element | null {
  const { t } = useI18n();
  const { targetLanguage } = useStudyLanguages();
  const rules = [...new Set(grammarFeatureKeys)].flatMap(key => {
    const feature = phraseGrammarFeaturePresentationFor(targetLanguage, key as PhraseGrammarFeatureKey);
    return feature ? [{ key, title: t(feature.title), explanation: t(feature.present) }] : [];
  });
  const pattern = patternKey ? wordFormationPattern(targetLanguage, patternKey) : undefined;
  if (pattern) rules.push({ key: pattern.id, title: pattern.label, explanation: t(pattern.note) });
  if (!rules.length) return null;

  return <aside className="practice-rule-note" role="note" aria-label={t("session.practicePattern")}>
    <span className="practice-rule-note-label">{t("session.practicePattern")}</span>
    <ul>{rules.map(rule => <li key={rule.key}>
      <strong>{rule.title}</strong>
      <p>{rule.explanation}</p>
    </li>)}</ul>
  </aside>;
}
