import type { JSX } from "react";
import type { StudyLanguageCode } from "../../types";
import type { GermanGrammarNounExample } from "../../types";
import type { NounGender } from "./useGrammarExamples";

export type StrategyEntry = { label?: string; source: string; target: string };
export type KeyedStrategyEntry = StrategyEntry & { key: string };

type SelectionActions<T> = {
  selectedKeys: string[];
  toggleEntry: (entry: T) => void;
  unselectAll: () => void;
  selectAll: () => void;
  selectRandom: () => void;
};

type GeneratedStrategy<T> = SelectionActions<T> & {
  isLoading: boolean;
  error: string;
};

export type RelatedEntry = {
  key: string;
  targetWord: string;
  sourceWord: string;
  exampleTarget: string;
  exampleSource: string;
};

export type ItemStrategiesModalProps = {
  itemType: "word" | "phrase";
  sourceText: string;
  targetText: string;
  targetLanguage: StudyLanguageCode;
  wordType: string;
  pluralGerman: string;
  selectedStrategy: string;
  onSelectedStrategyChange: (strategy: string) => void;
  onClose: () => void;
  exerciseSecondsLeft: number;
  exerciseRunning: boolean;
  exerciseMuted: boolean;
  canStart: boolean;
  onStart: () => void;
  onStop: () => void;
  onToggleMute: () => void;
  canRegenerateContent: boolean;
  regeneratingContent: boolean;
  onRegenerateContent: () => void;
  formsContent: JSX.Element;
  formsFooterAction?: JSX.Element;
  formsSelection: Omit<
    SelectionActions<never>,
    "selectedKeys" | "toggleEntry"
  > & {
    canSelectEntries: boolean;
    hasSelectedEntries: boolean;
  };
  createStrategy: SelectionActions<StrategyEntry> & {
    inputValue: string;
    setInputValue: (value: string) => void;
    generatePhrase: () => Promise<void>;
    isGenerating: boolean;
    error: string;
    entries: KeyedStrategyEntry[];
  };
  examplesStrategy: GeneratedStrategy<StrategyEntry> & {
    entries: KeyedStrategyEntry[];
  };
  relatedStrategy: GeneratedStrategy<RelatedEntry> & {
    sameFamily: RelatedEntry[];
  };
  visualizeStrategy: GeneratedStrategy<KeyedStrategyEntry> & {
    entry: KeyedStrategyEntry | null;
    isGeneratingImage: boolean;
  };
  actStrategy: GeneratedStrategy<KeyedStrategyEntry & { actions: string[] }> & {
    entry: (KeyedStrategyEntry & { actions: string[] }) | null;
  };
  walkStrategy: GeneratedStrategy<StrategyEntry> & {
    entries: KeyedStrategyEntry[];
  };
  decodeStrategy: GeneratedStrategy<RelatedEntry & { why: string }> & {
    analysis: {
      linguistic: {
        prefix?: string;
        root?: string;
        suffix?: string;
        lemma?: string;
        explanation?: string;
      } | null;
      memory: {
        decomposition?: string;
        explanation?: string;
      } | null;
      related: Array<RelatedEntry & { why: string }>;
    };
  };
  encounterStrategy: GeneratedStrategy<
    KeyedStrategyEntry & { title: string; description: string }
  > & {
    entries: Array<KeyedStrategyEntry & { title: string; description: string }>;
  };
  compareStrategy: GeneratedStrategy<{
    key: string;
    targetWord: string;
    sourceWord: string;
    difference: string;
    mistake: string;
    targetExample: string;
    targetTranslation: string;
    comparisonExample: string;
    comparisonTranslation: string;
  }> & {
    entries: Array<{
      key: string;
      targetWord: string;
      sourceWord: string;
      difference: string;
      mistake: string;
      targetExample: string;
      targetTranslation: string;
      comparisonExample: string;
      comparisonTranslation: string;
    }>;
  };
  onPlayVisualizeWord: () => void;
  grammarStrategy: {
    examples: Partial<Record<NounGender, GermanGrammarNounExample>>;
    isLoading: boolean;
  };
  phraseGrammarStrategy: {
    isOpen: boolean;
    isLoading: boolean;
    featurePresent: boolean | null;
    error: string;
    toggleVerbPosition: () => void;
    examples: Array<{ target_text: string; source_text: string }>;
    examplesVisible: boolean;
    isLoadingExamples: boolean;
    showExamples: () => void;
  };
};
