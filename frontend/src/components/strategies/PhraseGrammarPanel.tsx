import { useState } from "react";

import { useI18n } from "../../i18n";
import type { StudyLanguageCode } from "../../types";
import GrammarMethodologyFooter from "./GrammarMethodologyFooter";
import GrammarPhraseExampleList, { type GrammarPhraseExampleEntry } from "./GrammarPhraseExampleList";
import StrategyLoopPanel from "./StrategyLoopPanel";
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
    | "strategies.grammar.timeExpressionPosition"
    | "strategies.grammar.separableVerbMainClause"
    | "strategies.grammar.modalVerbWithInfinitive"
    | "strategies.grammar.reflexiveVerb"
    | "strategies.grammar.auxiliaryVerb"
    | "strategies.grammar.pastParticiple"
    | "strategies.grammar.perfectWithHabenOrSein"
    | "strategies.grammar.imperative"
    | "strategies.grammar.konjunktivIi"
    | "strategies.grammar.negationNicht"
    | "strategies.grammar.negationKein"
    | "strategies.grammar.prepositionAccusative"
    | "strategies.grammar.prepositionDative"
    | "strategies.grammar.twoWayPrepositionLocation"
    | "strategies.grammar.twoWayPrepositionDirection";
  present:
    | "strategies.grammar.verbPositionStatementNote"
    | "strategies.grammar.verbPositionYesNoQuestionNote"
    | "strategies.grammar.verbPositionWQuestionNote"
    | "strategies.grammar.verbPositionSubordinateClauseNote"
    | "strategies.grammar.timeExpressionPositionNote"
    | "strategies.grammar.separableVerbMainClauseNote"
    | "strategies.grammar.modalVerbWithInfinitiveNote"
    | "strategies.grammar.reflexiveVerbNote"
    | "strategies.grammar.auxiliaryVerbNote"
    | "strategies.grammar.pastParticipleNote"
    | "strategies.grammar.perfectWithHabenOrSeinNote"
    | "strategies.grammar.imperativeNote"
    | "strategies.grammar.konjunktivIiNote"
    | "strategies.grammar.negationNichtNote"
    | "strategies.grammar.negationKeinNote"
    | "strategies.grammar.prepositionAccusativeNote"
    | "strategies.grammar.prepositionDativeNote"
    | "strategies.grammar.twoWayPrepositionLocationNote"
    | "strategies.grammar.twoWayPrepositionDirectionNote";
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
  time_expression_position: {
    title: "strategies.grammar.timeExpressionPosition",
    present: "strategies.grammar.timeExpressionPositionNote",
    example: <><span>Ich gehe <strong>heute</strong> zur Arbeit.</span><br /><span><strong>Heute</strong> <strong>gehe</strong> ich zur Arbeit.</span></>,
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
  auxiliary_verb: {
    title: "strategies.grammar.auxiliaryVerb",
    present: "strategies.grammar.auxiliaryVerbNote",
    example: <>haben + gemacht → Ich <strong>habe</strong> das gemacht.</>,
  },
  past_participle: {
    title: "strategies.grammar.pastParticiple",
    present: "strategies.grammar.pastParticipleNote",
    example: <>machen → <strong>gemacht</strong></>,
  },
  perfect_with_haben_or_sein: {
    title: "strategies.grammar.perfectWithHabenOrSein",
    present: "strategies.grammar.perfectWithHabenOrSeinNote",
    example: <><span>machen → Ich <strong>habe</strong> das <strong>gemacht</strong>.</span><br /><span>gehen → Ich <strong>bin</strong> nach Hause <strong>gegangen</strong>.</span></>,
  },
  imperative: {
    title: "strategies.grammar.imperative",
    present: "strategies.grammar.imperativeNote",
    example: <>kommen → <strong>Komm!</strong> (du) · <strong>Kommt!</strong> (ihr) · <strong>Kommen Sie!</strong> (Sie)</>,
  },
  konjunktiv_ii: {
    title: "strategies.grammar.konjunktivIi",
    present: "strategies.grammar.konjunktivIiNote",
    example: <>können → Ich <strong>könnte</strong> kommen.</>,
  },
  negation_nicht: {
    title: "strategies.grammar.negationNicht",
    present: "strategies.grammar.negationNichtNote",
    example: <>Ich komme. → Ich komme <strong>nicht</strong>.</>,
  },
  negation_kein: {
    title: "strategies.grammar.negationKein",
    present: "strategies.grammar.negationKeinNote",
    example: <>Ich habe ein Auto. → Ich habe <strong>kein Auto</strong>.</>,
  },
  preposition_accusative: {
    title: "strategies.grammar.prepositionAccusative",
    present: "strategies.grammar.prepositionAccusativeNote",
    example: <>für → Das ist <strong>für den Hund</strong>.</>,
  },
  preposition_dative: {
    title: "strategies.grammar.prepositionDative",
    present: "strategies.grammar.prepositionDativeNote",
    example: <>mit → Ich komme <strong>mit dem Hund</strong>.</>,
  },
  two_way_preposition_location: {
    title: "strategies.grammar.twoWayPrepositionLocation",
    present: "strategies.grammar.twoWayPrepositionLocationNote",
    example: <>in + Wo? → Ich bin <strong>in der Küche</strong>.</>,
  },
  two_way_preposition_direction: {
    title: "strategies.grammar.twoWayPrepositionDirection",
    present: "strategies.grammar.twoWayPrepositionDirectionNote",
    example: <>in + Wohin? → Ich gehe <strong>in die Küche</strong>.</>,
  },
};

export default function PhraseGrammarPanel({
  targetLanguage,
  targetText,
  phraseGrammar,
  onAskAboutRule,
  onOpenItem,
  loop,
}: {
  targetLanguage: StudyLanguageCode;
  targetText: string;
  phraseGrammar: PhraseGrammarStrategy;
  onAskAboutRule: (question: string) => void;
  onOpenItem: (itemId: number) => void;
  loop: {
    secondsLeft: number;
    isRunning: boolean;
    isMuted: boolean;
    canStart: boolean;
    onStart: () => void;
    onStop: () => void;
    onToggleMute: () => void;
  };
}): JSX.Element {
  const { t } = useI18n();
  const [selectedExampleKeys, setSelectedExampleKeys] = useState<string[]>([]);
  if (targetLanguage !== "german") {
    return <GrammarPlaceholder />;
  }

  const exampleEntries = phraseGrammar.featureKeys.flatMap((featureKey) => (
    phraseGrammar.features[featureKey].examples.map((example, index) => ({
      key: `${featureKey}:${index}:${example.target_text}:${example.source_text}`,
      target: example.target_text,
      source: example.source_text,
      audioUrl: example.audio_url,
      itemId: example.item_id,
    }))
  ));
  const selectedExamples = exampleEntries.filter((entry) => selectedExampleKeys.includes(entry.key));
  const toggleExample = (entry: GrammarPhraseExampleEntry): void => {
    setSelectedExampleKeys((current) => (
      current.includes(entry.key)
        ? current.filter((key) => key !== entry.key)
        : [...current, entry.key]
    ));
  };
  const selectAllExamples = (): void => setSelectedExampleKeys(exampleEntries.map((entry) => entry.key));
  const selectRandomExample = (): void => {
    if (!exampleEntries.length) return;
    const randomEntry = exampleEntries[Math.floor(Math.random() * exampleEntries.length)];
    setSelectedExampleKeys([randomEntry.key]);
  };

  const grammarContent = (
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
                  <p className="grammar-phrase-feature-definition">
                    {t(copy.present)} {" "}
                    <button
                      type="button"
                      className="grammar-phrase-feature-question-link"
                      onClick={() => onAskAboutRule(t("strategies.grammar.askAboutRuleQuestion", {
                        rule: t(copy.title),
                        phrase: targetText,
                      }))}
                    >
                      {t("strategies.grammar.askAboutRule")}
                    </button>
                  </p>
                  <p className="grammar-phrase-feature-example">
                    <span className="grammar-phrase-feature-example-label">{t("strategies.grammar.example")}:</span> {copy.example}
                  </p>
                  {feature.isLoadingExamples && <p className="hint">{t("strategies.grammar.loadingExamples")}</p>}
                  {!feature.isLoadingExamples && (
                    feature.examples.length > 0 ? (
                      <div className="grammar-phrase-examples">
                        <GrammarPhraseExampleList
                          entries={exampleEntries.filter((entry) => entry.key.startsWith(`${featureKey}:`))}
                          selectedKeys={selectedExampleKeys}
                          onToggleEntry={toggleExample}
                          onOpenItem={onOpenItem}
                          disabled={loop.isRunning}
                        />
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

  return (
    <StrategyLoopPanel
      body={grammarContent}
      secondsLeft={loop.secondsLeft}
      isRunning={loop.isRunning}
      isMuted={loop.isMuted}
      canStart={Boolean(targetText.trim())}
      canSelectEntries={exampleEntries.length > 0}
      hasSelectedEntries={selectedExamples.length > 0}
      onUnselectAll={() => setSelectedExampleKeys([])}
      onSelectAll={selectAllExamples}
      onSelectRandom={selectRandomExample}
      onStart={() => loop.onStart({
        lines: [targetText, ...selectedExamples.map((entry) => entry.target)],
        audioSources: loop.originalAudioUrl && selectedExamples.every((entry) => entry.audioUrl)
          ? [loop.originalAudioUrl, ...selectedExamples.map((entry) => entry.audioUrl)]
          : [],
      })}
      onStop={loop.onStop}
      onToggleMute={loop.onToggleMute}
    />
  );
}

function GrammarPlaceholder(): JSX.Element {
  const { t } = useI18n();
  return <div className="word-strategies-placeholder-card grammar-strategy-panel"><p className="word-strategies-placeholder-title"><strong>{t("strategies.grammar.title")}</strong></p><GrammarMethodologyFooter /></div>;
}
