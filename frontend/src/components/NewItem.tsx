import { useEffect, useState } from "react";

import { useI18n } from "../i18n";
import type { SessionItem } from "../types";

interface NewItemProps {
  item: SessionItem;
  onContinue: () => Promise<void>;
}

export default function NewItem({ item, onContinue }: NewItemProps): JSX.Element {
  const { t } = useI18n();
  const [saving, setSaving] = useState<boolean>(false);

  const markAsSeen = async (): Promise<void> => {
    if (saving) {
      return;
    }
    setSaving(true);
    try {
      await onContinue();
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Enter") {
        return;
      }
      event.preventDefault();
      void markAsSeen();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [saving, onContinue]);

  return (
    <div>
      <p className="prompt">{item.item_type === "word" ? t("newItem.word") : t("newItem.phrase")}</p>
      <p>
        <strong>{t("newItem.spanish")}</strong> {item.spanish_text}
      </p>
      <p>
        <strong>{t("newItem.german")}</strong> {item.german_text}
      </p>
      <p>
        <strong>{t("newItem.example")}</strong> {item.example_sentence || "-"}
      </p>
      <p>
        <strong>{t("newItem.notes")}</strong> {item.notes || "-"}
      </p>
      {item.audio_url && (
        <>
          <audio controls src={item.audio_url}>
            {t("newItem.noAudioSupport")}
          </audio>
          {item.item_type === "word" && (
            <p>
              <a href={item.audio_url} target="_blank" rel="noreferrer">
                {t("newItem.audioLink")}
              </a>
            </p>
          )}
        </>
      )}
      <div className="actions">
        <button onClick={markAsSeen} disabled={saving}>
          {saving ? t("newItem.saving") : t("newItem.gotIt")}
        </button>
      </div>
    </div>
  );
}
