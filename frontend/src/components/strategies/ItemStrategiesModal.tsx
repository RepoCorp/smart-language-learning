import StrategiesModal from "./StrategiesModal";
import StrategyContent from "./StrategyContent";
import type { ItemStrategiesModalProps } from "./itemStrategyTypes";

export default function ItemStrategiesModal(props: ItemStrategiesModalProps): JSX.Element {
  return (
    <StrategiesModal
      itemType={props.itemType}
      sourceText={props.sourceText}
      targetText={props.targetText}
      selectedStrategy={props.selectedStrategy}
      onSelectedStrategyChange={props.onSelectedStrategyChange}
      onClose={props.onClose}
      strategyContent={<StrategyContent {...props} />}
    />
  );
}
