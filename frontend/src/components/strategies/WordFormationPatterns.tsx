import { useI18n } from "../../i18n";
import { useStudyLanguages } from "../../studyLanguages";
import PatternEnrollment from "./PatternEnrollment";
import { matchWordFormationPatterns } from "../../languageFeatures/wordFormation";
import "./WordFormationPatterns.css";

export default function WordFormationPatterns({ targetText, wordType, targetLanguage, actionLabel, disabled, onSavingChange }: {
  targetText: string;
  wordType: string;
  targetLanguage: string;
  actionLabel?: string;
  disabled?: boolean;
  onSavingChange?: (saving: boolean) => void;
}): JSX.Element | null {
  const { t } = useI18n();
  const { sourceLanguage } = useStudyLanguages();
  const matches = matchWordFormationPatterns(targetText, wordType, targetLanguage);
  if (!matches.length) return null;

  return (
    <section className="word-formation-patterns">
      <h3>{t("wordFormation.title")}</h3>
      {matches.map(({ pattern }) => {
        const example = pattern.example;
        const exampleMatch = pattern.expression.exec(example.word)!;
        const affixes = pattern.label.toLowerCase().split("/").map(affix => affix.trim());
        return (
          <article key={pattern.id} className="word-formation-card" aria-label={pattern.label}>
            <p>{t(pattern.note).split(/(-\p{L}+|\p{L}+-)/u).map((part, index) =>
              affixes.includes(part.toLowerCase()) ? <strong key={index}>{part}</strong> : part,
            )}</p>
            <p className="grammar-phrase-feature-example">
              {example.base} → {example.word.slice(0, exampleMatch.index)}<strong>{exampleMatch[0]}</strong>{example.word.slice(exampleMatch.index + exampleMatch[0].length)}
              <span className="word-formation-translation">{t(example.translation)}</span>
            </p>
            <PatternEnrollment key={`${sourceLanguage}:${targetLanguage}:${pattern.id}`} pattern={pattern.id} source={sourceLanguage} target={targetLanguage}
              actionLabel={actionLabel} disabled={disabled} onSavingChange={onSavingChange} />
          </article>
        );
      })}
    </section>
  );
}
