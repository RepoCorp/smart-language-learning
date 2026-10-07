import type { ComponentType, ReactElement } from "react";
import { useI18n } from "../../../i18n";
import type { LearningDefinition } from "../definition";
import { locales } from "../locales";
import type { DefinitionViewProps } from "./types";

export function withDefinition<D extends LearningDefinition>(
  accepts: (definition: LearningDefinition) => definition is D,
  View: ComponentType<DefinitionViewProps<D>>,
): ComponentType<DefinitionViewProps> {
  return function DefinitionView(props: DefinitionViewProps): ReactElement {
    const { language } = useI18n();
    if (!accepts(props.definition)) {
      return <p role="alert">{locales[props.interfaceLanguage ?? language].unavailableContent}</p>;
    }
    return <View {...props} definition={props.definition} />;
  };
}
