import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { fetchContentWords } from "../api";
import { useI18n } from "../i18n";
import { useStudyLanguages } from "../studyLanguages";
import type { WordLibraryItem } from "../types";

export default function WordsPage(): JSX.Element {
  const { t } = useI18n();
  const { sourceLanguage, targetLanguage } = useStudyLanguages();
  const [query, setQuery] = useState<string>("");
  const [items, setItems] = useState<WordLibraryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [selectedItem, setSelectedItem] = useState<WordLibraryItem | null>(null);

  useEffect(() => {
    let active = true;
    const timeoutId = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetchContentWords(sourceLanguage, targetLanguage, query);
        if (!active) {
          return;
        }
        setItems(response.words || []);
      } catch {
        if (active) {
          setItems([]);
          setError(t("words.error"));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }, 200);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [sourceLanguage, targetLanguage, query, t]);

  const sortedDialogs = useMemo(() => {
    if (!selectedItem) {
      return [];
    }
    return [...selectedItem.related_dialogs].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [selectedItem]);

  return (
    <main className="container">
      <h1>{t("words.title")}</h1>
      <p>{t("words.description")}</p>
      <p>
        <Link to="/session">{t("manage.backToSession")}</Link> |{" "}
        <Link to="/content/create">{t("manage.backToCreate")}</Link> |{" "}
        <Link to="/content/manage">{t("content.manageLink")}</Link>
      </p>

      <section className="card">
        <label htmlFor="words-search" className="prompt">{t("words.searchLabel")}</label>
        <input
          id="words-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("words.searchPlaceholder")}
        />
      </section>

      {loading && <p>{t("words.loading")}</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && (
        <section className="card">
          {!items.length && <p>{t("words.empty")}</p>}
          {!!items.length && (
            <ul className="manage-list">
              {items.map((item) => (
                <li key={item.id} className="manage-row">
                  <button
                    type="button"
                    className="word-link-button"
                    onClick={() => setSelectedItem(item)}
                  >
                    {item.spanish_text} - {item.german_text}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {selectedItem && (
        <div className="blocking-modal-overlay" role="dialog" aria-modal="true">
          <div className="blocking-modal related-dialogs-modal">
            <p><strong>{t("words.itemTitle")}</strong></p>
            <p><strong>{selectedItem.spanish_text}</strong> - {selectedItem.german_text}</p>
            <p><strong>{t("newItem.example")}</strong> {selectedItem.example_sentence || "-"}</p>
            <p><strong>{t("newItem.notes")}</strong> {selectedItem.notes || "-"}</p>
            {selectedItem.audio_url && (
              <audio controls src={selectedItem.audio_url}>
                {t("newItem.noAudioSupport")}
              </audio>
            )}
            {!!sortedDialogs.length && (
              <div className="related-dialogs-scroll">
                {sortedDialogs.map((dialog) => {
                  const matchedTurnIndexes = new Set(dialog.matched_turns.map((turn) => turn.turn_index));
                  return (
                    <div key={dialog.dialog_id} className="related-dialog-card">
                      <p><strong>{dialog.topic}</strong></p>
                      <p><strong>{t("newItem.dialogContext")}:</strong> {dialog.context || t("newItem.dialogNoContext")}</p>
                      {dialog.audio_url && (
                        <audio controls src={dialog.audio_url}>
                          {t("newItem.noAudioSupport")}
                        </audio>
                      )}
                      <ul className="conversation-preview-list">
                        {dialog.turns.map((turn, index) => (
                          <li
                            key={`${dialog.dialog_id}-${index}`}
                            className={`conversation-turn ${index % 2 === 0 ? "speaker-a" : "speaker-b"} ${
                              matchedTurnIndexes.has(index) ? "turn-highlight" : ""
                            }`}
                          >
                            <p className="conversation-line">{turn.source_text}</p>
                            <p className="conversation-line conversation-line-translation">{turn.target_text}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="actions">
              <button type="button" onClick={() => setSelectedItem(null)}>
                {t("words.close")}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
