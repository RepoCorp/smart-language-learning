import { useEffect, useState } from "react";

import type { SessionItem } from "../types";

interface NewItemProps {
  item: SessionItem;
  onContinue: () => Promise<void>;
}

export default function NewItem({ item, onContinue }: NewItemProps): JSX.Element {
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
      <p className="prompt">New {item.item_type === "word" ? "word" : "phrase"}</p>
      <p>
        <strong>Spanish:</strong> {item.spanish_text}
      </p>
      <p>
        <strong>German:</strong> {item.german_text}
      </p>
      <p>
        <strong>Example:</strong> {item.example_sentence || "-"}
      </p>
      <p>
        <strong>Notes:</strong> {item.notes || "-"}
      </p>
      {item.audio_url && (
        <>
          <audio controls src={item.audio_url}>
            Your browser does not support audio.
          </audio>
          {item.item_type === "word" && (
            <p>
              <a href={item.audio_url} target="_blank" rel="noreferrer">
                Audio link
              </a>
            </p>
          )}
        </>
      )}
      <div className="actions">
        <button onClick={markAsSeen} disabled={saving}>
          {saving ? "Saving..." : "Got it"}
        </button>
      </div>
    </div>
  );
}
