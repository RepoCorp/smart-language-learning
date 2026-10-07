import { useEffect, useId, useRef, useState, type ReactElement } from "react";
import ItemViewShell from "../../../components/itemView/ItemViewShell";
import { useI18n } from "../../../i18n";
import { locales } from "../locales";
import type { LearningDefinition } from "../definition";
import type { AffixPatternViewProps } from "../patterns/affix/AffixPatternView";
import { getEvaluation } from "./registry";
import "./evaluations.css";

type Direction = keyof LearningDefinition["evaluations"];

export default function DefinitionEvaluationsModal({ onClose, ...props }: AffixPatternViewProps & {
  onClose: () => void;
}): ReactElement {
  const { language } = useI18n();
  const interfaceLanguage = props.interfaceLanguage ?? language;
  const text = locales[interfaceLanguage];
  const directions = Object.keys(props.definition.evaluations) as Direction[];
  const [selected, setSelected] = useState(directions[0]);
  const id = props.definition.evaluations[selected];
  const evaluation = id ? getEvaluation(id) : undefined;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const close = (): void => {
    dialogRef.current?.close();
    onClose();
  };
  useEffect(() => {
    const dialog = dialogRef.current!;
    dialog.showModal();
    return () => { if (dialog.open) dialog.close(); };
  }, []);

  return <dialog ref={dialogRef} className="definition-evaluations-modal" aria-labelledby={headingId}
    onCancel={event => { event.preventDefault(); close(); }}>
    <ItemViewShell onClose={close} closeLabel={text.close}>
      <h2 id={headingId}>{text.testingTitle}</h2>
      <div className="strategy-picker">
        <select className="word-strategies-select" aria-label={text.testingTitle} value={selected}
          onChange={event => setSelected(event.target.value as Direction)}>
          {directions.map(direction => {
            const registered = getEvaluation(props.definition.evaluations[direction]!);
            return <option key={direction} value={direction}>{registered ? text[registered.label] : text.unavailableEvaluation}</option>;
          })}
        </select>
      </div>
      {evaluation ? <evaluation.View key={`${props.definition.key}:${props.sourceLanguage}:${selected}`} {...props} interfaceLanguage={interfaceLanguage} />
        : <p role="alert">{text.unavailableEvaluation}</p>}
    </ItemViewShell>
  </dialog>;
}
