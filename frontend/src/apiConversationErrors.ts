import { API_BASE, apiFetch } from "./apiCore";
import type { StudyLanguageCode } from "./types";

export async function requestConversationTurnErrorInfo(
  originalText: string,
  correctedText: string,
  sourceLanguage: StudyLanguageCode,
  targetLanguage: StudyLanguageCode,
): Promise<ConversationTurnErrorAnalysis> {
  const params = new URLSearchParams({
    source_language: sourceLanguage,
    target_language: targetLanguage,
  });
  const response = await apiFetch(`${API_BASE}/content/conversation/error-analysis?${params.toString()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ original_text: originalText, corrected_text: correctedText }),
  });
  if (!response.ok) {
    let detail = "Failed to analyze the correction";
    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload.detail) {
        detail = payload.detail;
      }
    } catch {
      // Keep the useful generic message when the server response is unavailable.
    }
    throw new Error(detail);
  }
  const payload = (await response.json()) as {
    error_text?: string;
    grammar_feature_keys?: string[];
    word_item_targets?: string[];
  };
  if (!payload.error_text) {
    throw new Error("The error analysis was empty");
  }
  return {
    errorText: payload.error_text,
    grammarFeatureKeys: payload.grammar_feature_keys || [],
    wordItemTargets: payload.word_item_targets || [],
  };
}

export type ConversationTurnErrorAnalysis = {
  errorText: string;
  grammarFeatureKeys: string[];
  wordItemTargets: string[];
};

export async function addConversationErrorExercises(
  analysis: ConversationTurnErrorAnalysis,
  sourceLanguage: StudyLanguageCode,
  targetLanguage: StudyLanguageCode,
): Promise<number[]> {
  const params = new URLSearchParams({
    source_language: sourceLanguage,
    target_language: targetLanguage,
  });
  const response = await apiFetch(`${API_BASE}/content/conversation/error-exercises?${params.toString()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grammar_feature_keys: analysis.grammarFeatureKeys,
      word_item_targets: analysis.wordItemTargets,
    }),
  });
  if (!response.ok) {
    throw new Error("Failed to add exercises");
  }
  const payload = (await response.json()) as { added_item_ids?: number[] };
  return payload.added_item_ids || [];
}
