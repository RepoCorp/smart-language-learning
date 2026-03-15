import { useState } from "react";
import { Link } from "react-router-dom";

import { confirmContent, previewContent } from "../api";
import type { ContentPreviewResponse } from "../types";

export default function ContentCreatePage(): JSX.Element {
  const [topic, setTopic] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [preview, setPreview] = useState<ContentPreviewResponse | null>(null);
  const [selectedWords, setSelectedWords] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<string>("");

  const onGeneratePreview = async (): Promise<void> => {
    setError("");
    setResult("");
    setPreview(null);
    setSelectedWords({});

    if (!topic.trim()) {
      setError("Please enter a topic.");
      return;
    }

    setLoading(true);
    try {
      const data = await previewContent(topic.trim());
      setPreview(data);
      const initialSelection: Record<string, boolean> = {};
      for (const word of data.words) {
        initialSelection[word.spanish_text.toLowerCase()] = !word.exists;
      }
      setSelectedWords(initialSelection);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate preview");
    } finally {
      setLoading(false);
    }
  };

  const onConfirmSave = async (): Promise<void> => {
    if (!preview) {
      return;
    }

    setSaving(true);
    setError("");
    try {
      const wordsToSave = preview.words
        .filter((word) => !word.exists && selectedWords[word.spanish_text.toLowerCase()])
        .map((word) => word.spanish_text);
      const response = await confirmContent(preview.topic, wordsToSave);
      const phraseMessage = response.created_phrase ? "phrase created" : "phrase already existed";
      if (!wordsToSave.length) {
        setResult(`Saved: no new words selected, ${phraseMessage}.`);
      } else {
        setResult(`Saved: ${response.created_words_count} word(s), ${phraseMessage}.`);
      }
      setPreview(null);
      setSelectedWords({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save content");
    } finally {
      setSaving(false);
    }
  };

  const toggleWordSelection = (wordKey: string): void => {
    setSelectedWords((current) => ({
      ...current,
      [wordKey]: !current[wordKey],
    }));
  };

  return (
    <main className="container" data-testid="content-create-page">
      <h1>Create content</h1>
      <p>Enter a topic and the app will generate a simple sentence and candidate vocabulary.</p>
      <p>
        <Link to="/session">Back to session</Link>
      </p>

      <section className="card">
        <label htmlFor="topic-input" className="prompt">Topic</label>
        <input
          id="topic-input"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. travel, cooking, machine learning"
          disabled={loading || saving}
        />
        <div className="actions">
          <button onClick={() => void onGeneratePreview()} disabled={loading || saving}>
            {loading ? "Generating..." : "Generate preview"}
          </button>
        </div>
      </section>

      {error && <p className="error">{error}</p>}
      {result && <p>{result}</p>}

      {preview && (
        <section className="card">
          <h2>Preview</h2>
          <p><strong>Phrase (Spanish):</strong> {preview.phrase.spanish_text}</p>
          <p><strong>Phrase (German):</strong> {preview.phrase.german_text}</p>
          <p><strong>Phrase status:</strong> {preview.phrase.exists ? "already exists" : "new"}</p>

          {(() => {
            const selectedNewWordsCount = preview.words.filter(
              (word) => !word.exists && selectedWords[word.spanish_text.toLowerCase()],
            ).length;
            const newItemsToSave = (preview.phrase.exists ? 0 : 1) + selectedNewWordsCount;
            return (
              <p><strong>New items to save:</strong> {newItemsToSave}</p>
            );
          })()}

          <p><strong>Candidate words:</strong></p>
          <ul>
            {preview.words.map((word) => (
              <li key={word.spanish_text.toLowerCase()}>
                {word.exists ? (
                  <>
                    {word.spanish_text} (already exists)
                  </>
                ) : (
                  <label>
                    <input
                      type="checkbox"
                      checked={Boolean(selectedWords[word.spanish_text.toLowerCase()])}
                      onChange={() => toggleWordSelection(word.spanish_text.toLowerCase())}
                      disabled={saving}
                    />{" "}
                    {word.spanish_text} (new)
                  </label>
                )}
              </li>
            ))}
          </ul>
          <div className="actions">
            <button onClick={() => void onConfirmSave()} disabled={saving}>
              {saving ? "Saving..." : "Confirm and save"}
            </button>
            <button onClick={() => setPreview(null)} disabled={saving}>
              Cancel
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
