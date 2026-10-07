import { useEffect, useId, useRef, useState, type ReactElement } from "react";
import ItemViewShell from "../../../components/itemView/ItemViewShell";
import { useI18n } from "../../../i18n";
import { locales } from "../locales";
import type { DefinitionViewProps } from "../itemViews/types";
import { getStrategy } from "./registry";
import "./DefinitionStrategiesModal.css";

export default function DefinitionStrategiesModal({ onClose, ...props }: DefinitionViewProps & {
  onClose: () => void;
}): ReactElement {
  const { language } = useI18n();
  const interfaceLanguage = props.interfaceLanguage ?? language;
  const text = locales[interfaceLanguage];
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const [selected, setSelected] = useState(props.definition.strategies[0]);
  const strategy = props.definition.strategies.includes(selected) ? getStrategy(selected) : undefined;
  const display = props.definition.display[interfaceLanguage];
  const close = (): void => {
    dialogRef.current?.close();
    onClose();
  };

  useEffect(() => {
    const dialog = dialogRef.current!;
    dialog.showModal();
    return () => { if (dialog.open) dialog.close(); };
  }, []);

  return <dialog ref={dialogRef} className="definition-strategies-modal" aria-labelledby={headingId}
    onCancel={event => { event.preventDefault(); close(); }}>
    <ItemViewShell onClose={close} closeLabel={text.close}>
      <h2 id={headingId}>{text.strategiesTitle}</h2>
      {!display ? <p role="alert">{text.unavailableTranslation}</p> : <>
        <div className="strategy-picker">
          <select className="word-strategies-select" aria-label={text.strategiesTitle} value={selected}
            onChange={event => setSelected(event.target.value)}>
            {props.definition.strategies.map(id => {
              const registered = getStrategy(id);
              return <option key={id} value={id}>{registered ? text[registered.label] : text.unavailableStrategy}</option>;
            })}
          </select>
        </div>
        {strategy ? <strategy.View {...props} strategyId={selected} interfaceLanguage={interfaceLanguage} />
          : <p role="alert">{text.unavailableStrategy}</p>}
      </>}
    </ItemViewShell>
  </dialog>;
}
