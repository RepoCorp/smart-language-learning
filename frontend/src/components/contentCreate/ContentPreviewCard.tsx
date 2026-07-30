import { useEffect, useState } from "react";

import { useI18n } from "../../i18n";
import type { ContentPreviewResponse } from "../../types";
import TargetPhraseText from "../TargetPhraseText";

function speakerForTurn(speaker: string | undefined, index: number): "a" | "b" {
  return speaker === "a" || speaker === "b" ? speaker : (index % 2 === 0 ? "a" : "b");
}

export default function ContentPreviewCard({
  preview,
  saving,
  loading,
  onAccept,
  onDiscard,
}: {
  preview: ContentPreviewResponse;
  saving: boolean;
  loading: boolean;
  onAccept: () => void;
  onDiscard: () => void;
}): JSX.Element {
  const { t } = useI18n();
  const [open, setOpen] = useState<boolean>(false);

  useEffect(() => {
    setOpen(true);
  }, [preview]);

  return (
    <section className="card content-create-card">
      <button
        type="button"
        className="content-collapsible-trigger"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="content-collapsible-trigger-copy">
          <strong>{t("content.preview.title")}</strong>
          <span className="content-collapsible-trigger-subtitle">{preview.topic}</span>
        </span>
        <span className={`content-collapsible-trigger-icon${open ? " content-collapsible-trigger-icon-open" : ""}`} aria-hidden="true">
          ▾
        </span>
      </button>
      {open && (
        <div className="content-collapsible-body">
          <ul className="conversation-preview-list">
            {preview.dialog_turns.map((turn, index) => {
              const speaker = speakerForTurn(turn.speaker, index);
              return (
                <li
                  key={`${turn.source_text.toLowerCase()}|||${turn.target_text.toLowerCase()}|||${index}`}
                  className={`conversation-turn ${speaker === "a" ? "speaker-a" : "speaker-b"}`}
                >
                  <p className="conversation-speaker">{speaker === "a" ? t("content.preview.personA") : t("content.preview.personB")}</p>
                  <TargetPhraseText as="p" className="conversation-line" variant="dialog" text={turn.target_text} />
                  <p className="conversation-line">{turn.source_text}</p>
                </li>
              );
            })}
          </ul>
          <div className="actions">
            <button onClick={onAccept} disabled={saving || loading}>
              {saving ? t("content.saving") : t("content.preview.acceptDialog")}
            </button>
            <button onClick={onDiscard} disabled={saving || loading}>
              {t("content.preview.discardDialog")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
