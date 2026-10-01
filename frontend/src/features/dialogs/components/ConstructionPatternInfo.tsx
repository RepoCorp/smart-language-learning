import { useState } from "react";
import { useI18n } from "../../../i18n";
import { saveConstructionPattern } from "../../../apiConstructionPatterns";
import type { ConstructionPatternPreview } from "./wordAddPreview";

export const constructionPreviewCopy = {
  en: {
    title: "Construction pattern",
    pending: "Save this pattern to review it in your sessions.",
    saved: "Pattern saved. You can review it in your sessions.",
    save: "Save pattern",
    saving: "Saving pattern...",
    failed: "The pattern could not be saved. Try again, or reopen this preview if it has expired.",
    wordSaved: "Word already saved",
    related: "These separated parts belong to one verb. Add saves the complete verb, not a separate pattern.",
    close: "Close",
  },
  es: {
    title: "Patrón de construcción",
    pending: "Guarda este patrón para repasarlo en tus sesiones.",
    saved: "Patrón guardado. Puedes repasarlo en tus sesiones.",
    save: "Guardar patrón",
    saving: "Guardando patrón...",
    failed: "No se pudo guardar el patrón. Inténtalo de nuevo o vuelve a abrir esta vista si ha caducado.",
    wordSaved: "Palabra ya guardada",
    related: "Estas partes separadas pertenecen a un solo verbo. Agregar guarda el verbo completo, no un patrón aparte.",
    close: "Cerrar",
  },
};

export default function ConstructionPatternInfo({ pattern, onBusyChange }: {
  pattern: ConstructionPatternPreview;
  onBusyChange?: (busy: boolean) => void;
}): JSX.Element {
  const { language } = useI18n();
  const copy = constructionPreviewCopy[language];
  const [saved, setSaved] = useState(Boolean(pattern.saved_id));
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const save = async () => {
    if (!pattern.save_token || saved || saving) return;
    setSaving(true);
    setFailed(false);
    onBusyChange?.(true);
    try {
      await saveConstructionPattern(pattern.save_token);
      setSaved(true);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
      onBusyChange?.(false);
    }
  };
  return (
    <section>
      {!pattern.replaces_word && <p><strong>{copy.title}</strong></p>}
      <p>{pattern.explanation}</p>
      <p>{pattern.example}</p>
      {!pattern.replaces_word && <p className="hint">{copy.related}</p>}
      <p className="hint" role={saved ? "status" : undefined}>{saved ? copy.saved : copy.pending}</p>
      {failed && <p role="alert">{copy.failed}</p>}
      {!saved && pattern.save_token && <button type="button" className="secondary-button" onClick={() => void save()} disabled={saving}>
        {saving ? copy.saving : copy.save}
      </button>}
    </section>
  );
}
