import { useI18n } from "../../i18n";
import PersonalizeStrategyPanel from "./PersonalizeStrategyPanel";
import PracticeStrategyPanel from "./PracticeStrategyPanel";
import StrategiesModal from "./StrategiesModal";
import StrategyLoopPanel from "./StrategyLoopPanel";
import { DEFAULT_STRATEGY, PERSONALIZE_STRATEGY, PRACTICE_STRATEGY } from "./strategyConstants";

type StrategyEntry = { label?: string; source: string; target: string };

export default function ItemStrategiesModal({
  itemType,
  sourceText,
  targetText,
  pluralText,
  selectedStrategy,
  onSelectedStrategyChange,
  onClose,
  exerciseSecondsLeft,
  exerciseRunning,
  exerciseMuted,
  canStart,
  onStart,
  onStop,
  onToggleMute,
  formsContent,
  formsSelection,
  personalizeStrategy,
  practiceStrategy,
}: {
  itemType: "word" | "phrase";
  sourceText: string;
  targetText: string;
  pluralText?: string;
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
  formsContent: JSX.Element;
  formsSelection: {
    canSelectEntries: boolean;
    hasSelectedEntries: boolean;
    unselectAll: () => void;
    selectAll: () => void;
    selectRandom: () => void;
  };
  personalizeStrategy: {
    inputValue: string;
    setInputValue: (value: string) => void;
    generatePhrase: () => Promise<void>;
    isGenerating: boolean;
    error: string;
    entries: Array<StrategyEntry & { key: string }>;
    selectedKeys: string[];
    toggleEntry: (entry: StrategyEntry) => void;
    unselectAll: () => void;
    selectAll: () => void;
    selectRandom: () => void;
  };
  practiceStrategy: {
    entries: Array<StrategyEntry & { key: string }>;
    selectedKeys: string[];
    toggleEntry: (entry: StrategyEntry) => void;
    isLoading: boolean;
    error: string;
    unselectAll: () => void;
    selectAll: () => void;
    selectRandom: () => void;
  };
}): JSX.Element {
  const { t } = useI18n();

  let strategyContent: JSX.Element;
  if (selectedStrategy === PERSONALIZE_STRATEGY && itemType === "word") {
    strategyContent = (
      <StrategyLoopPanel
        secondsLeft={exerciseSecondsLeft}
        isRunning={exerciseRunning}
        isMuted={exerciseMuted}
        canStart={canStart}
        canSelectEntries={personalizeStrategy.entries.length > 0}
        hasSelectedEntries={personalizeStrategy.selectedKeys.length > 0}
        onUnselectAll={personalizeStrategy.unselectAll}
        onSelectAll={personalizeStrategy.selectAll}
        onSelectRandom={personalizeStrategy.selectRandom}
        onStart={onStart}
        onStop={onStop}
        onToggleMute={onToggleMute}
        body={(
          <PersonalizeStrategyPanel
            inputValue={personalizeStrategy.inputValue}
            onInputChange={personalizeStrategy.setInputValue}
            onGenerate={() => {
              void personalizeStrategy.generatePhrase();
            }}
            isGenerating={personalizeStrategy.isGenerating}
            error={personalizeStrategy.error}
            entries={personalizeStrategy.entries}
            selectedKeys={personalizeStrategy.selectedKeys}
            onToggleEntry={personalizeStrategy.toggleEntry}
            exerciseRunning={exerciseRunning}
          />
        )}
      />
    );
  } else if (selectedStrategy === DEFAULT_STRATEGY) {
    strategyContent = (
      <StrategyLoopPanel
        secondsLeft={exerciseSecondsLeft}
        isRunning={exerciseRunning}
        isMuted={exerciseMuted}
        canStart={canStart}
        canSelectEntries={formsSelection.canSelectEntries}
        hasSelectedEntries={formsSelection.hasSelectedEntries}
        onUnselectAll={formsSelection.unselectAll}
        onSelectAll={formsSelection.selectAll}
        onSelectRandom={formsSelection.selectRandom}
        onStart={onStart}
        onStop={onStop}
        onToggleMute={onToggleMute}
        body={formsContent}
      />
    );
  } else if (selectedStrategy === PRACTICE_STRATEGY && itemType === "word") {
    strategyContent = (
      <StrategyLoopPanel
        secondsLeft={exerciseSecondsLeft}
        isRunning={exerciseRunning}
        isMuted={exerciseMuted}
        canStart={canStart}
        canSelectEntries={practiceStrategy.entries.length > 0}
        hasSelectedEntries={practiceStrategy.selectedKeys.length > 0}
        onUnselectAll={practiceStrategy.unselectAll}
        onSelectAll={practiceStrategy.selectAll}
        onSelectRandom={practiceStrategy.selectRandom}
        onStart={onStart}
        onStop={onStop}
        onToggleMute={onToggleMute}
        body={(
          <PracticeStrategyPanel
            entries={practiceStrategy.entries}
            selectedKeys={practiceStrategy.selectedKeys}
            onToggleEntry={practiceStrategy.toggleEntry}
            exerciseRunning={exerciseRunning}
            isLoading={practiceStrategy.isLoading}
            error={practiceStrategy.error}
          />
        )}
      />
    );
  } else {
    strategyContent = (
      <div className="word-strategies-placeholder-card">
        <p className="word-strategies-placeholder-title">
          <strong>{selectedStrategy}</strong>
        </p>
        <p className="hint">{t("newItem.strategiesPlaceholder", { strategy: selectedStrategy })}</p>
      </div>
    );
  }

  return (
    <StrategiesModal
      itemType={itemType}
      sourceText={sourceText}
      targetText={targetText}
      pluralText={pluralText}
      selectedStrategy={selectedStrategy}
      onSelectedStrategyChange={onSelectedStrategyChange}
      onClose={onClose}
      strategyContent={strategyContent}
    />
  );
}
