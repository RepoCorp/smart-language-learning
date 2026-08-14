import { useI18n } from "../../i18n";
import ActStrategyPanel from "./ActStrategyPanel";
import CompareStrategyPanel from "./CompareStrategyPanel";
import CreateStrategyPanel from "./CreateStrategyPanel";
import DecodeStrategyPanel from "./DecodeStrategyPanel";
import EncounterStrategyPanel from "./EncounterStrategyPanel";
import ExamplesStrategyPanel from "./ExamplesStrategyPanel";
import FormsStrategyPanel from "./FormsStrategyPanel";
import GrammarStrategyPanel from "./GrammarStrategyPanel";
import RelatedStrategyPanel from "./RelatedStrategyPanel";
import StrategyLoopContent from "./StrategyLoopContent";
import VisualizeStrategyPanel from "./VisualizeStrategyPanel";
import WalkStrategyPanel from "./WalkStrategyPanel";
import type { ItemStrategiesModalProps } from "./itemStrategyTypes";
import {
  ACT_STRATEGY,
  COMPARE_STRATEGY,
  CREATE_STRATEGY,
  DECODE_STRATEGY,
  DEFAULT_STRATEGY,
  ENCOUNTER_STRATEGY,
  EXAMPLES_STRATEGY,
  GRAMMAR_STRATEGY,
  RELATED_STRATEGY,
  VISUALIZE_STRATEGY,
  WALK_STRATEGY,
} from "./strategyConstants";

type Props = ItemStrategiesModalProps;

export default function StrategyContent(props: Props): JSX.Element {
  const { t } = useI18n();
  const loopProps = {
    secondsLeft: props.exerciseSecondsLeft,
    isRunning: props.exerciseRunning,
    isMuted: props.exerciseMuted,
    canStart: props.canStart,
    onStart: props.onStart,
    onStop: props.onStop,
    onToggleMute: props.onToggleMute,
    canRegenerateContent: props.canRegenerateContent,
    regeneratingContent: props.regeneratingContent,
    onRegenerateContent: props.onRegenerateContent,
  };
  const selection = (strategy: {
    selectedKeys: string[];
    unselectAll: () => void;
    selectAll: () => void;
    selectRandom: () => void;
  }, canSelectEntries: boolean) => ({
    canSelectEntries,
    hasSelectedEntries: strategy.selectedKeys.length > 0,
    onUnselectAll: strategy.unselectAll,
    onSelectAll: strategy.selectAll,
    onSelectRandom: strategy.selectRandom,
  });

  if (props.selectedStrategy === GRAMMAR_STRATEGY) {
    return (
      <GrammarStrategyPanel
        wordType={props.wordType}
        targetLanguage={props.targetLanguage}
        targetText={props.targetText}
        pluralGerman={props.pluralGerman}
        examples={props.grammarStrategy.examples}
        isLoadingExamples={props.grammarStrategy.isLoading}
        itemType={props.itemType}
        phraseGrammar={props.phraseGrammarStrategy}
        onAskAboutPhraseGrammarRule={props.onAskAboutPhraseGrammarRule}
        onOpenPhraseGrammarExample={props.onOpenPhraseGrammarExample}
        phraseGrammarLoop={props.phraseGrammarLoop}
      />
    );
  }
  if (props.selectedStrategy === CREATE_STRATEGY && props.itemType === "word") {
    return (
      <StrategyLoopContent {...loopProps} selection={selection(props.createStrategy, props.createStrategy.entries.length > 0)} body={
        <CreateStrategyPanel inputValue={props.createStrategy.inputValue} onInputChange={props.createStrategy.setInputValue} onGenerate={() => void props.createStrategy.generatePhrase()} isGenerating={props.createStrategy.isGenerating} error={props.createStrategy.error} entries={props.createStrategy.entries} selectedKeys={props.createStrategy.selectedKeys} onToggleEntry={props.createStrategy.toggleEntry} exerciseRunning={props.exerciseRunning} />
      } />
    );
  }
  if (props.selectedStrategy === DEFAULT_STRATEGY) {
    return (
      <StrategyLoopContent {...loopProps} selection={props.formsSelection} additionalDangerAction={props.formsFooterAction} body={props.formsContent} />
    );
  }
  if (props.selectedStrategy === EXAMPLES_STRATEGY && props.itemType === "word") {
    return (
      <StrategyLoopContent {...loopProps} selection={selection(props.examplesStrategy, props.examplesStrategy.entries.length > 0)} body={
        <ExamplesStrategyPanel entries={props.examplesStrategy.entries} selectedKeys={props.examplesStrategy.selectedKeys} onToggleEntry={props.examplesStrategy.toggleEntry} exerciseRunning={props.exerciseRunning} isLoading={props.examplesStrategy.isLoading} error={props.examplesStrategy.error} />
      } />
    );
  }
  if (props.selectedStrategy === RELATED_STRATEGY && props.itemType === "word") {
    return (
      <StrategyLoopContent {...loopProps} selection={selection(props.relatedStrategy, props.relatedStrategy.sameFamily.length > 0)} body={
        <RelatedStrategyPanel sameFamily={props.relatedStrategy.sameFamily} selectedKeys={props.relatedStrategy.selectedKeys} onToggleEntry={props.relatedStrategy.toggleEntry} exerciseRunning={props.exerciseRunning} isLoading={props.relatedStrategy.isLoading} error={props.relatedStrategy.error} />
      } />
    );
  }
  if (props.selectedStrategy === VISUALIZE_STRATEGY && props.itemType === "word") {
    return (
      <StrategyLoopContent {...loopProps} selection={selection(props.visualizeStrategy, Boolean(props.visualizeStrategy.entry))} body={
        <VisualizeStrategyPanel entry={props.visualizeStrategy.entry} selectedKeys={props.visualizeStrategy.selectedKeys} onToggleEntry={props.visualizeStrategy.toggleEntry} exerciseRunning={props.exerciseRunning} isLoading={props.visualizeStrategy.isLoading} isGeneratingImage={props.visualizeStrategy.isGeneratingImage} error={props.visualizeStrategy.error} onPlayImageWord={props.onPlayVisualizeWord} />
      } />
    );
  }
  if (props.selectedStrategy === ACT_STRATEGY && props.itemType === "word") {
    return (
      <StrategyLoopContent {...loopProps} selection={selection(props.actStrategy, Boolean(props.actStrategy.entry))} body={
        <ActStrategyPanel entry={props.actStrategy.entry} selectedKeys={props.actStrategy.selectedKeys} onToggleEntry={props.actStrategy.toggleEntry} exerciseRunning={props.exerciseRunning} isLoading={props.actStrategy.isLoading} error={props.actStrategy.error} />
      } />
    );
  }
  if (props.selectedStrategy === WALK_STRATEGY && props.itemType === "word") {
    return (
      <StrategyLoopContent {...loopProps} selection={selection(props.walkStrategy, props.walkStrategy.entries.length > 0)} body={
        <WalkStrategyPanel challenge={props.walkStrategy.entries[0]?.label || ""} targetWord={props.targetText} entries={props.walkStrategy.entries} selectedKeys={props.walkStrategy.selectedKeys} onToggleEntry={props.walkStrategy.toggleEntry} exerciseRunning={props.exerciseRunning} isLoading={props.walkStrategy.isLoading} error={props.walkStrategy.error} />
      } />
    );
  }
  if (props.selectedStrategy === DECODE_STRATEGY && props.itemType === "word") {
    return (
      <StrategyLoopContent {...loopProps} selection={selection(props.decodeStrategy, props.decodeStrategy.analysis.related.length > 0)} body={
        <DecodeStrategyPanel linguistic={props.decodeStrategy.analysis.linguistic} memory={props.decodeStrategy.analysis.memory} related={props.decodeStrategy.analysis.related} selectedKeys={props.decodeStrategy.selectedKeys} onToggleEntry={props.decodeStrategy.toggleEntry} exerciseRunning={props.exerciseRunning} isLoading={props.decodeStrategy.isLoading} error={props.decodeStrategy.error} />
      } />
    );
  }
  if (props.selectedStrategy === ENCOUNTER_STRATEGY && props.itemType === "word") {
    return (
      <StrategyLoopContent {...loopProps} selection={selection(props.encounterStrategy, props.encounterStrategy.entries.length > 0)} body={
        <EncounterStrategyPanel entries={props.encounterStrategy.entries} selectedKeys={props.encounterStrategy.selectedKeys} onToggleEntry={props.encounterStrategy.toggleEntry} exerciseRunning={props.exerciseRunning} isLoading={props.encounterStrategy.isLoading} error={props.encounterStrategy.error} />
      } />
    );
  }
  if (props.selectedStrategy === COMPARE_STRATEGY && props.itemType === "word") {
    return (
      <StrategyLoopContent {...loopProps} selection={selection(props.compareStrategy, props.compareStrategy.entries.length > 0)} body={
        <CompareStrategyPanel entries={props.compareStrategy.entries} selectedKeys={props.compareStrategy.selectedKeys} onToggleEntry={props.compareStrategy.toggleEntry} exerciseRunning={props.exerciseRunning} isLoading={props.compareStrategy.isLoading} error={props.compareStrategy.error} />
      } />
    );
  }
  return (
    <div className="word-strategies-placeholder-card">
      <p className="word-strategies-placeholder-title"><strong>{props.selectedStrategy}</strong></p>
      <p className="hint">{t("newItem.strategiesPlaceholder", { strategy: props.selectedStrategy })}</p>
    </div>
  );
}
