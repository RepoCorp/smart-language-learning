import { API_BASE, apiFetch } from "./apiCore";
import type { ItemExercisePhrases, StudyLanguageCode } from "./types";

export async function generateContentItemSong(
  itemId: number,
  sourceLanguage: StudyLanguageCode,
  targetLanguage: StudyLanguageCode,
): Promise<{ exercise_phrases: ItemExercisePhrases }> {
  const params = new URLSearchParams({ source_language: sourceLanguage, target_language: targetLanguage });
  const response = await apiFetch(`${API_BASE}/content/items/${itemId}/strategies/sing?${params}`, { method: "POST" });
  if (!response.ok) {
    let detail = "Failed to create song";
    try {
      detail = ((await response.json()) as { detail?: string }).detail || detail;
    } catch {
      // Keep the default when the response is not JSON.
    }
    throw new Error(detail);
  }
  return (await response.json()) as { exercise_phrases: ItemExercisePhrases };
}

export async function generateContentItemSongLyrics(
  itemId: number,
  sourceLanguage: StudyLanguageCode,
  targetLanguage: StudyLanguageCode,
): Promise<{ exercise_phrases: ItemExercisePhrases }> {
  const params = new URLSearchParams({ source_language: sourceLanguage, target_language: targetLanguage, lyrics: "true" });
  const response = await apiFetch(`${API_BASE}/content/items/${itemId}/strategies/sing?${params}`, { method: "POST" });
  if (!response.ok) {
    let detail = "Failed to create song lyrics";
    try {
      detail = ((await response.json()) as { detail?: string }).detail || detail;
    } catch {
      // Keep the default when the response is not JSON.
    }
    throw new Error(detail);
  }
  return (await response.json()) as { exercise_phrases: ItemExercisePhrases };
}

export async function generateContentItemSongImage(
  itemId: number,
  sourceLanguage: StudyLanguageCode,
  targetLanguage: StudyLanguageCode,
): Promise<{ exercise_phrases: ItemExercisePhrases }> {
  const params = new URLSearchParams({ source_language: sourceLanguage, target_language: targetLanguage, image: "true" });
  const response = await apiFetch(`${API_BASE}/content/items/${itemId}/strategies/sing?${params}`, { method: "POST" });
  if (!response.ok) {
    let detail = "Failed to create song image";
    try {
      detail = ((await response.json()) as { detail?: string }).detail || detail;
    } catch {
      // Keep the default when the response is not JSON.
    }
    throw new Error(detail);
  }
  return (await response.json()) as { exercise_phrases: ItemExercisePhrases };
}

export async function retryContentItemSong(
  itemId: number,
  sourceLanguage: StudyLanguageCode,
  targetLanguage: StudyLanguageCode,
): Promise<{ exercise_phrases: ItemExercisePhrases }> {
  const params = new URLSearchParams({ source_language: sourceLanguage, target_language: targetLanguage, retry: "true" });
  const response = await apiFetch(`${API_BASE}/content/items/${itemId}/strategies/sing?${params}`, { method: "POST" });
  if (!response.ok) {
    let detail = "Failed to retry song";
    try {
      detail = ((await response.json()) as { detail?: string }).detail || detail;
    } catch {
      // Keep the default when the response is not JSON.
    }
    throw new Error(detail);
  }
  return (await response.json()) as { exercise_phrases: ItemExercisePhrases };
}
