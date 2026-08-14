import { useI18n } from "../../i18n";
import type { StudyLanguageCode } from "../../types";
import TargetPhraseText from "../TargetPhraseText";
import GrammarMethodologyFooter from "./GrammarMethodologyFooter";
import {
  type PhraseGrammarFeatureKey,
  type PhraseGrammarStrategy,
} from "./phraseGrammarTypes";

const FEATURE_COPY: Record<PhraseGrammarFeatureKey, {
  title:
    | "strategies.grammar.verbPositionStatement"
    | "strategies.grammar.verbPositionYesNoQuestion"
    | "strategies.grammar.verbPositionWQuestion"
    | "strategies.grammar.verbPositionSubordinateClause"
    | "strategies.grammar.separableVerbMainClause"
    | "strategies.grammar.modalVerbWithInfinitive"
    | "strategies.grammar.reflexiveVerb";
  present:
    | "strategies.grammar.verbPositionStatementNote"
    | "strategies.grammar.verbPositionYesNoQuestionNote"
    | "strategies.grammar.verbPositionWQuestionNote"
    | "strategies.grammar.verbPositionSubordinateClauseNote"
    | "strategies.grammar.separableVerbMainClauseNote"
    | "strategies.grammar.modalVerbWithInfinitiveNote"
    | "strategies.grammar.reflexiveVerbNote";
  example: JSX.Element;
}> = {
  verb_position_main_clause: {
    title: "strategies.grammar.verbPositionStatement",
    present: "strategies.grammar.verbPositionStatementNote",
    example: <>Ich <strong>komme</strong> heute.</>,
  },
  verb_position_yes_no_question: {
    title: "strategies.grammar.verbPositionYesNoQuestion",
    present: "strategies.grammar.verbPositionYesNoQuestionNote",
    example: <><strong>Kommst</strong> du heute?</>,
  },
  verb_position_w_question: {
    title: "strategies.grammar.verbPositionWQuestion",
    present: "strategies.grammar.verbPositionWQuestionNote",
    example: <><strong>Wo</strong> <strong>wohnst</strong> du?</>,
  },
  verb_position_subordinate_clause: {
    title: "strategies.grammar.verbPositionSubordinateClause",
    present: "strategies.grammar.verbPositionSubordinateClauseNote",
    example: <><strong>weil</strong> ich heute <strong>komme</strong></>,
  },
  separable_verb_main_clause: {
    title: "strategies.grammar.separableVerbMainClause",
    present: "strategies.grammar.separableVerbMainClauseNote",
    example: <>aufstehen → Ich <strong>stehe</strong> <strong>auf</strong>.</>,
  },
  modal_verb_with_infinitive: {
    title: "strategies.grammar.modalVerbWithInfinitive",
    present: "strategies.grammar.modalVerbWithInfinitiveNote",
    example: <>Ich <strong>muss</strong> <strong>arbeiten</strong>.</>,
  },
  reflexive_verb: {
    title: "strategies.grammar.reflexiveVerb",
    present: "strategies.grammar.reflexiveVerbNote",
    example: <>sich freuen → Ich <strong>freue mich</strong>.</>,
  },
};

export default function PhraseGrammarPanel({
  targetLanguage,
  phraseGrammar,
}: {
  targetLanguage: StudyLanguageCode;
  phraseGrammar: PhraseGrammarStrategy;
}): JSX.Element {
  const { t } = useI18n();
  if (targetLanguage !== "german") {
    return <GrammarPlaceholder />;
  }

  return (
    <div className="grammar-strategy-panel">
      <div className="actions">
        <button type="button" className="secondary-button" onClick={phraseGrammar.refresh} disabled={phraseGrammar.isLoading}>
          {t("strategies.grammar.refresh")}
        </button>
      </div>
      {phraseGrammar.isLoading && <p className="hint">{t("strategies.grammar.checking")}</p>}
      {phraseGrammar.error && <p className="error">{phraseGrammar.error}</p>}
      <div className="grammar-phrase-features">
        {phraseGrammar.featureKeys.map((featureKey) => {
          const feature = phraseGrammar.features[featureKey];
          const copy = FEATURE_COPY[featureKey];
          return (
            <section key={featureKey} className="content-collapsible-card">
              <button type="button" className="content-collapsible-trigger" aria-expanded={feature.isOpen} onClick={() => phraseGrammar.toggleFeature(featureKey)}>
                <span className="content-collapsible-trigger-copy"><strong>{t(copy.title)}</strong></span>
                <span className={`content-collapsible-trigger-icon${feature.isOpen ? " content-collapsible-trigger-icon-open" : ""}`} aria-hidden="true">▾</span>
              </button>
              {feature.isOpen && (
                <div className="content-collapsible-body">
                  {feature.error && <p className="error">{feature.error}</p>}
                  <p className="grammar-phrase-feature-definition">{t(copy.present)}</p>
                  <p className="grammar-phrase-feature-example">
                    <span className="grammar-phrase-feature-example-label">{t("strategies.grammar.example")}:</span> {copy.example}
                  </p>
                  {feature.isLoadingExamples && <p className="hint">{t("strategies.grammar.loadingExamples")}</p>}
                  {!feature.isLoadingExamples && (
                    feature.examples.length > 0 ? (
                      <div className="grammar-phrase-examples">
                        {feature.examples.map((example) => <div key={`${example.target_text}|||${example.source_text}`} className="grammar-phrase-example"><TargetPhraseText as="p" text={example.target_text} variant="dialog" /><p className="dialog-turn-translation">{example.source_text}</p></div>)}
                      </div>
                    ) : <p className="hint">{t("strategies.grammar.noExamples")}</p>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
      {!phraseGrammar.isLoading && !phraseGrammar.error && phraseGrammar.featureKeys.length === 0 && (
        <p className="hint">{t("strategies.grammar.noPhraseFeatures")}</p>
      )}
      <GrammarMethodologyFooter />
    </div>
  );
}

function GrammarPlaceholder(): JSX.Element {
  const { t } = useI18n();
  return <div className="word-strategies-placeholder-card grammar-strategy-panel"><p className="word-strategies-placeholder-title"><strong>{t("strategies.grammar.title")}</strong></p><GrammarMethodologyFooter /></div>;
}
