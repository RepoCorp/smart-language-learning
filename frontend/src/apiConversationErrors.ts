import { API_BASE, apiFetch } from "./apiCore";
import type { StudyLanguageCode } from "./types";

export async function requestConversationTurnErrorInfo(
  originalText: string,
  correctedText: string,
  sourceLanguage: StudyLanguageCode,
  targetLanguage: StudyLanguageCode,
): Promise<string> {
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
  const payload = (await response.json()) as { error_text?: string };
  if (!payload.error_text) {
    throw new Error("The error analysis was empty");
  }
  return payload.error_text;
}
