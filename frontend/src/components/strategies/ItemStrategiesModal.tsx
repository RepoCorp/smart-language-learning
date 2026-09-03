import StrategiesModal from "./StrategiesModal";
import StrategyContent from "./StrategyContent";
import type { ItemStrategiesModalProps } from "./itemStrategyTypes";
import { useI18n } from "../../i18n";
import {
  ACT_STRATEGY,
  COMPARE_STRATEGY,
  CREATE_STRATEGY,
  DECODE_STRATEGY,
  ENCOUNTER_STRATEGY,
  EXAMPLES_STRATEGY,
  GRAMMAR_STRATEGY,
  RELATED_STRATEGY,
  VISUALIZE_STRATEGY,
  WALK_STRATEGY,
  SING_STRATEGY,
} from "./strategyConstants";

export default function ItemStrategiesModal(props: ItemStrategiesModalProps): JSX.Element {
  const { t } = useI18n();
  const strategyLoading = isStrategyLoading(props);
  const loadingMessage = props.selectedStrategy === GRAMMAR_STRATEGY
    ? t("strategies.grammar.checking")
    : t("loading.preparingPractice");
  return (
    <StrategiesModal
      itemType={props.itemType}
      sourceText={props.sourceText}
      targetText={props.targetText}
      selectedStrategy={props.selectedStrategy}
      onSelectedStrategyChange={props.onSelectedStrategyChange}
      onClose={props.onClose}
      loading={strategyLoading}
      loadingMessage={loadingMessage}
      strategyContent={<StrategyContent {...props} />}
    />
  );
}

function isStrategyLoading(props: ItemStrategiesModalProps): boolean {
  switch (props.selectedStrategy) {
    case CREATE_STRATEGY:
      return props.createStrategy.isGenerating;
    case EXAMPLES_STRATEGY:
      return props.examplesStrategy.isLoading;
    case RELATED_STRATEGY:
      return props.relatedStrategy.isLoading;
    case VISUALIZE_STRATEGY:
      return props.visualizeStrategy.isLoading || props.visualizeStrategy.isGeneratingImage;
    case ACT_STRATEGY:
      return props.actStrategy.isLoading;
    case WALK_STRATEGY:
      return props.walkStrategy.isLoading;
    case SING_STRATEGY:
      return props.singStrategy.isLoading;
    case DECODE_STRATEGY:
      return props.decodeStrategy.isLoading;
    case ENCOUNTER_STRATEGY:
      return props.encounterStrategy.isLoading;
    case COMPARE_STRATEGY:
      return props.compareStrategy.isLoading;
    case GRAMMAR_STRATEGY:
      return props.itemType === "phrase"
        ? props.phraseGrammarStrategy.isLoading
        : props.grammarStrategy.isLoading;
    default:
      return props.regeneratingContent;
  }
}
