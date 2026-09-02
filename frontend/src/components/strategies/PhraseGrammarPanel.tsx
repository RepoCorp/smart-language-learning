import { useState } from "react";

import { useI18n } from "../../i18n";
import type { StudyLanguageCode } from "../../types";
import GrammarMethodologyFooter from "./GrammarMethodologyFooter";
import { phraseGrammarFeaturePresentationFor, supportsPhraseGrammar } from "./phraseGrammarFeatureCatalog";
import GrammarPhraseExampleList, { type GrammarPhraseExampleEntry } from "./GrammarPhraseExampleList";
import StrategyLoopPanel from "./StrategyLoopPanel";
import type { PhraseGrammarFeatureKey, PhraseGrammarStrategy } from "./phraseGrammarTypes";

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
  onAskAboutRule: (question: string, grammarFeatureKey: PhraseGrammarFeatureKey) => void;
  onOpenItem: (itemId: number) => void;
  loop: {
    secondsLeft: number;
    isRunning: boolean;
    isMuted: boolean;
    canStart: boolean;
    originalAudioUrl?: string;
    onStart: (options: { lines: string[]; audioSources: string[] }) => void;
    onStop: () => void;
    onToggleMute: () => void;
  };
}): JSX.Element {
  const { t } = useI18n();
  const [selectedExampleKeys, setSelectedExampleKeys] = useState<string[]>([]);
  if (!supportsPhraseGrammar(targetLanguage)) return <GrammarPlaceholder />;

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
    setSelectedExampleKeys([exampleEntries[Math.floor(Math.random() * exampleEntries.length)].key]);
  };

  return (
    <StrategyLoopPanel
      body={(
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
              const presentation = phraseGrammarFeaturePresentationFor(targetLanguage, featureKey);
              const feature = phraseGrammar.features[featureKey];
              if (!presentation) return null;
              return (
                <section key={featureKey} className="content-collapsible-card">
                  <button type="button" className="content-collapsible-trigger" aria-expanded={feature.isOpen} onClick={() => phraseGrammar.toggleFeature(featureKey)}>
                    <span className="content-collapsible-trigger-copy"><strong>{t(presentation.title)}</strong></span>
                    <span className={`content-collapsible-trigger-icon${feature.isOpen ? " content-collapsible-trigger-icon-open" : ""}`} aria-hidden="true">▾</span>
                  </button>
                  {feature.isOpen && (
                    <div className="content-collapsible-body">
                      {feature.error && <p className="error">{feature.error}</p>}
                      <p className="grammar-phrase-feature-definition">
                        {t(presentation.present)} {" "}
                        <button
                          type="button"
                          className="grammar-phrase-feature-question-link"
                          onClick={() => onAskAboutRule(
                            t("strategies.grammar.askAboutRuleQuestion", { rule: t(presentation.title), phrase: targetText }),
                            featureKey,
                          )}
                        >
                          {t("strategies.grammar.askAboutRule")}
                        </button>
                      </p>
                      <p className="grammar-phrase-feature-example">
                        <span className="grammar-phrase-feature-example-label">{t("strategies.grammar.example")}:</span> {presentation.example}
                      </p>
                      {feature.isLoadingExamples && <p className="hint">{t("strategies.grammar.loadingExamples")}</p>}
                      {!feature.isLoadingExamples && (feature.examples.length > 0 ? (
                        <div className="grammar-phrase-examples">
                          <GrammarPhraseExampleList
                            entries={exampleEntries.filter((entry) => entry.key.startsWith(`${featureKey}:`))}
                            selectedKeys={selectedExampleKeys}
                            onToggleEntry={toggleExample}
                            onOpenItem={onOpenItem}
                            disabled={loop.isRunning}
                          />
                        </div>
                      ) : <p className="hint">{t("strategies.grammar.noExamples")}</p>)}
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
      )}
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
