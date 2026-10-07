import { useState, type ReactElement } from "react";
import { useI18n } from "../../../i18n";
import ItemView from "../itemViews/ItemView";
import type { DefinitionViewProps } from "../itemViews/types";
import { locales } from "../locales";

export default function ItemPreview({ narrow, ...props }: DefinitionViewProps & { narrow: boolean }): ReactElement {
  const { language } = useI18n();
  const [open, setOpen] = useState(true);
  if (!open) return <button type="button" autoFocus onClick={() => setOpen(true)}>{locales[language].openItemView}</button>;
  return <section className={`card learning-content-playground__preview${narrow ? " learning-content-playground__preview--narrow" : ""}`}
    aria-label={locales[language].preview}>
    <ItemView {...props} onClose={() => setOpen(false)} />
  </section>;
}
