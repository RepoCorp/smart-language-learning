import { API_BASE, apiFetch } from "./apiCore";
import type { StudyLanguageCode } from "./studyLanguages";

export type PhraseGrammarPoolResult = {
  status: "processed" | "empty";
  item_id?: number;
  feature_keys?: string[];
};

export async function processPhraseGrammarPoolCandidate(
  sourceLanguage: StudyLanguageCode,
  targetLanguage: StudyLanguageCode,
): Promise<PhraseGrammarPoolResult> {
  const response = await apiFetch(`${API_BASE}/config/phrase-grammar-pool`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source_language: sourceLanguage,
      target_language: targetLanguage,
    }),
  });
  if (!response.ok) {
    let detail = "Failed to build the grammar example pool";
    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload.detail) detail = payload.detail;
    } catch {
      // Keep the action-level error.
    }
    throw new Error(detail);
  }
  return (await response.json()) as PhraseGrammarPoolResult;
}
