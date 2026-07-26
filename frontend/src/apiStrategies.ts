import { API_BASE, apiFetch } from "./apiCore";
import type { ContentItemPersonalizeResponse, StudyLanguageCode } from "./types";

export async function personalizeContentItemPhrase(
  itemId: number,
  sourceText: string,
  sourceLanguage: StudyLanguageCode = "spanish",
  targetLanguage: StudyLanguageCode = "german",
): Promise<ContentItemPersonalizeResponse> {
  const params = new URLSearchParams({
    source_language: sourceLanguage,
    target_language: targetLanguage,
  });
  const response = await apiFetch(`${API_BASE}/content/items/${itemId}/strategies/personalize?${params.toString()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source_text: sourceText }),
  });
  if (!response.ok) {
    let detail = "Failed to personalize phrase";
    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload.detail) {
        detail = payload.detail;
      }
    } catch {
      // Keep default message.
    }
    throw new Error(detail);
  }
  return (await response.json()) as ContentItemPersonalizeResponse;
}
