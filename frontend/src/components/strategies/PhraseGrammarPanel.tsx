import { useI18n } from "../../i18n";
import type { StudyLanguageCode } from "../../types";
import TargetPhraseText from "../TargetPhraseText";
import {
  PHRASE_GRAMMAR_FEATURE_KEYS,
  type PhraseGrammarFeatureKey,
  type PhraseGrammarStrategy,
} from "./phraseGrammarTypes";

const FEATURE_COPY: Record<PhraseGrammarFeatureKey, {
  title: "strategies.grammar.verbPositionStatement" | "strategies.grammar.verbPositionYesNoQuestion";
  present: "strategies.grammar.verbPositionStatementNote" | "strategies.grammar.verbPositionYesNoQuestionNote";
}> = {
  verb_position_main_clause: {
    title: "strategies.grammar.verbPositionStatement",
    present: "strategies.grammar.verbPositionStatementNote",
  },
  verb_position_yes_no_question: {
    title: "strategies.grammar.verbPositionYesNoQuestion",
    present: "strategies.grammar.verbPositionYesNoQuestionNote",
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
      <p className="grammar-strategy-intro">{t("strategies.grammar.description")}</p>
      <div className="grammar-phrase-features">
        {PHRASE_GRAMMAR_FEATURE_KEYS.map((featureKey) => {
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
                  {feature.isLoading && <p className="hint">{t("strategies.grammar.checking")}</p>}
                  {feature.error && <p className="error">{feature.error}</p>}
                  {feature.featurePresent === true && <>
                    <p>{t(copy.present)}</p>
                    {!feature.examplesVisible && <button type="button" className="secondary-button" onClick={() => phraseGrammar.showExamples(featureKey)}>{t("strategies.grammar.showExamples")}</button>}
                    {feature.isLoadingExamples && <p className="hint">{t("strategies.grammar.loadingExamples")}</p>}
                    {feature.examplesVisible && !feature.isLoadingExamples && (
                      feature.examples.length > 0 ? (
                        <div className="grammar-phrase-examples">
                          {feature.examples.map((example) => <div key={`${example.target_text}|||${example.source_text}`} className="grammar-phrase-example"><TargetPhraseText as="p" text={example.target_text} variant="dialog" /><p className="dialog-turn-translation">{example.source_text}</p></div>)}
                        </div>
                      ) : <p className="hint">{t("strategies.grammar.noExamples")}</p>
                    )}
                  </>}
                  {feature.featurePresent === false && <p className="hint">{t("strategies.grammar.verbPositionNotShown")}</p>}
                </div>
              )}
            </section>
          );
        })}
      </div>
      <p className="hint grammar-strategy-footnote">{t("strategies.grammar.footnote")}</p>
    </div>
  );
}

function GrammarPlaceholder(): JSX.Element {
  const { t } = useI18n();
  return <div className="word-strategies-placeholder-card grammar-strategy-panel"><p className="word-strategies-placeholder-title"><strong>{t("strategies.grammar.title")}</strong></p><p>{t("strategies.grammar.description")}</p><p className="hint grammar-strategy-footnote">{t("strategies.grammar.footnote")}</p></div>;
}
