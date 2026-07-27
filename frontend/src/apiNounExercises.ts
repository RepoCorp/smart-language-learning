import { API_BASE, apiFetch } from "./apiCore";
import type { ItemExercisePhrases, StudyLanguageCode } from "./types";

export async function generateContentItemExercises(
  itemId: number,
  sourceLanguage: StudyLanguageCode = "spanish",
  targetLanguage: StudyLanguageCode = "german",
): Promise<{ exercise_phrases?: ItemExercisePhrases }> {
  const params = new URLSearchParams({
    source_language: sourceLanguage,
    target_language: targetLanguage,
  });
  const response = await apiFetch(`${API_BASE}/content/items/${itemId}/exercises?${params.toString()}`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error("Failed to generate word exercises");
  }
  return (await response.json()) as { exercise_phrases?: ItemExercisePhrases };
}

export async function generateContentItemNounExerciseCase(
  itemId: number,
  caseKey: "nominative" | "accusative" | "dative" | "genitive",
  sourceLanguage: StudyLanguageCode = "spanish",
  targetLanguage: StudyLanguageCode = "german",
): Promise<{ exercise_phrases?: ItemExercisePhrases }> {
  const params = new URLSearchParams({
    source_language: sourceLanguage,
    target_language: targetLanguage,
    case_key: caseKey,
  });
  const response = await apiFetch(`${API_BASE}/content/items/${itemId}/exercises/noun-case?${params.toString()}`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error("Failed to generate noun case exercises");
  }
  return (await response.json()) as { exercise_phrases?: ItemExercisePhrases };
}
