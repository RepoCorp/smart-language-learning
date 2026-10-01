import { useState } from "react";
import { useI18n } from "../../../i18n";
import ConstructionPatternInfo, { constructionPreviewCopy } from "./ConstructionPatternInfo";
import type { WordAddPreview } from "./wordAddPreview";
import { useStudyLanguages } from "../../../studyLanguages";
import WordFormationPatterns from "../../../components/strategies/WordFormationPatterns";

export default function WordAddConfirmation({ item, saving, onCancel, onConfirm }: {
  item: WordAddPreview;
  saving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}): JSX.Element {
  const { t, language } = useI18n();
  const { targetLanguage } = useStudyLanguages();
  const patternOnly = Boolean(item.construction?.replaces_word);
  const copy = constructionPreviewCopy[language];
  const [savingPattern, setSavingPattern] = useState(false);
  const busy = saving || savingPattern;
  return (
    <div className="blocking-modal-overlay" role="dialog" aria-modal="true">
      <div className="blocking-modal add-word-modal">
        <p className="add-word-modal-title"><strong>{patternOnly ? copy.title : t("newItem.wordAddTitle")}</strong></p>
        <p className="add-word-modal-word">{item.target}</p>
        <p className="add-word-modal-meaning">{t("newItem.wordAddMeaning", { translation: item.source })}</p>
        {!patternOnly && <p className="add-word-modal-type"><strong>{t("newItem.wordAddType", { type: item.wordType })}</strong></p>}
        {item.construction && <ConstructionPatternInfo key={item.construction.save_token} pattern={item.construction} onBusyChange={setSavingPattern} />}
        {!patternOnly && <WordFormationPatterns targetText={item.target} wordType={item.wordType} targetLanguage={targetLanguage}
          actionLabel={copy.save} disabled={busy} onSavingChange={setSavingPattern} />}
        {!patternOnly && <p className="hint">{t("newItem.wordAddPrompt")}</p>}
        <div className="actions">
          <button type="button" className="secondary-button" onClick={onCancel} disabled={busy}>{patternOnly ? copy.close : t("newItem.wordAddCancel")}</button>
          {!patternOnly && <button type="button" onClick={onConfirm} disabled={busy || item.wordSaved}>{item.wordSaved ? copy.wordSaved : saving ? t("newItem.wordAddSaving") : t("newItem.wordAddConfirmButton")}</button>}
        </div>
      </div>
    </div>
  );
}
