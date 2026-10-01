import { useEffect, useRef, useState } from "react";
import { fetchWordFormationProgress, saveWordFormationPattern } from "../../apiWordFormation";
import { useI18n } from "../../i18n";

export default function PatternEnrollment({ pattern, source, target, actionLabel, disabled = false, onSavingChange }: {
  pattern: string; source: string; target: string;
  actionLabel?: string;
  disabled?: boolean;
  onSavingChange?: (saving: boolean) => void;
}): JSX.Element {
  const { t } = useI18n();
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "saved" | "unsupported" | "error">("loading");
  const [saveError, setSaveError] = useState(false);
  const [reload, setReload] = useState(0);
  const saving = useRef(false);
  useEffect(() => {
    let active = true;
    setStatus("loading");
    setSaveError(false);
    void fetchWordFormationProgress(source, target).then(result => {
      if (active) setStatus(!result.supported ? "unsupported" : result.saved.includes(pattern) ? "saved" : "ready");
    }).catch(() => { if (active) setStatus("error"); });
    return () => { active = false; };
  }, [pattern, source, target, reload]);

  const save = async (): Promise<void> => {
    if (saving.current || disabled || status !== "ready") return;
    saving.current = true;
    onSavingChange?.(true);
    setStatus("saving");
    setSaveError(false);
    try {
      await saveWordFormationPattern(pattern, source, target);
      setStatus("saved");
    } catch {
      setSaveError(true);
      setStatus("ready");
    } finally {
      saving.current = false;
      onSavingChange?.(false);
    }
  };

  if (status === "unsupported") return <p className="hint">{t("wordFormation.unavailable")}</p>;
  if (status === "error") return <div role="alert">{t("wordFormation.loadFailed")} <button type="button" onClick={() => setReload(value => value + 1)}>{t("wordFormation.retry")}</button></div>;
  return <>
    <button type="button" className="secondary-button" disabled={disabled || status !== "ready"} onClick={() => void save()}>
      {status === "ready" && actionLabel ? actionLabel : t(status === "saved" ? "wordFormation.saved" : status === "saving" ? "wordFormation.saving" : status === "loading" ? "wordFormation.loading" : "wordFormation.practise")}
    </button>
    {saveError && <p role="alert" className="error">{t("wordFormation.saveFailed")}</p>}
  </>;
}
