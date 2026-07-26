import { API_BASE, apiFetch } from "./apiCore";
import type {
  ContentItemActResponse,
  ContentItemConnectResponse,
  ContentItemPersonalizeResponse,
  ContentItemPracticeResponse,
  ContentItemVisualizeResponse,
  StudyLanguageCode,
} from "./types";

export async function generateContentItemActExercise(
  itemId: number,
  sourceLanguage: StudyLanguageCode = "spanish",
  targetLanguage: StudyLanguageCode = "german",
): Promise<ContentItemActResponse> {
  const params = new URLSearchParams({
    source_language: sourceLanguage,
    target_language: targetLanguage,
  });
  const response = await apiFetch(`${API_BASE}/content/items/${itemId}/strategies/act?${params.toString()}`, {
    method: "POST",
  });
  if (!response.ok) {
    let detail = "Failed to generate act exercise";
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
  return (await response.json()) as ContentItemActResponse;
}

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

export async function generateContentItemPracticePhrases(
  itemId: number,
  sourceLanguage: StudyLanguageCode = "spanish",
  targetLanguage: StudyLanguageCode = "german",
): Promise<ContentItemPracticeResponse> {
  const params = new URLSearchParams({
    source_language: sourceLanguage,
    target_language: targetLanguage,
  });
  const response = await apiFetch(`${API_BASE}/content/items/${itemId}/strategies/practice?${params.toString()}`, {
    method: "POST",
  });
  if (!response.ok) {
    let detail = "Failed to generate practice phrases";
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
  return (await response.json()) as ContentItemPracticeResponse;
}

export async function generateContentItemConnectWords(
  itemId: number,
  sourceLanguage: StudyLanguageCode = "spanish",
  targetLanguage: StudyLanguageCode = "german",
): Promise<ContentItemConnectResponse> {
  const params = new URLSearchParams({
    source_language: sourceLanguage,
    target_language: targetLanguage,
  });
  const response = await apiFetch(`${API_BASE}/content/items/${itemId}/strategies/connect?${params.toString()}`, {
    method: "POST",
  });
  if (!response.ok) {
    let detail = "Failed to generate connected words";
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
  return (await response.json()) as ContentItemConnectResponse;
}

export async function generateContentItemVisualizePhrase(
  itemId: number,
  sourceLanguage: StudyLanguageCode = "spanish",
  targetLanguage: StudyLanguageCode = "german",
): Promise<ContentItemVisualizeResponse> {
  const params = new URLSearchParams({
    source_language: sourceLanguage,
    target_language: targetLanguage,
  });
  const response = await apiFetch(`${API_BASE}/content/items/${itemId}/strategies/visualize?${params.toString()}`, {
    method: "POST",
  });
  if (!response.ok) {
    let detail = "Failed to generate visualize phrase";
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
  return (await response.json()) as ContentItemVisualizeResponse;
}
