import { API_BASE, apiFetch } from "./apiCore";
import type {
  ContentItemActResponse,
  ContentItemRelatedResponse,
  ContentItemCompareResponse,
  ContentItemPersonalizeResponse,
  ContentItemPracticeResponse,
  ContentItemDecodeResponse,
  ContentItemEncounterResponse,
  ContentItemVisualizeResponse,
  ContentItemWalkResponse,
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
  const response = await apiFetch(
    `${API_BASE}/content/items/${itemId}/strategies/act?${params.toString()}`,
    {
      method: "POST",
    },
  );
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
  const response = await apiFetch(
    `${API_BASE}/content/items/${itemId}/strategies/personalize?${params.toString()}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_text: sourceText }),
    },
  );
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
  const response = await apiFetch(
    `${API_BASE}/content/items/${itemId}/strategies/practice?${params.toString()}`,
    {
      method: "POST",
    },
  );
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

export async function generateContentItemRelatedWords(
  itemId: number,
  sourceLanguage: StudyLanguageCode = "spanish",
  targetLanguage: StudyLanguageCode = "german",
): Promise<ContentItemRelatedResponse> {
  const params = new URLSearchParams({
    source_language: sourceLanguage,
    target_language: targetLanguage,
  });
  const response = await apiFetch(
    `${API_BASE}/content/items/${itemId}/strategies/related?${params.toString()}`,
    {
      method: "POST",
    },
  );
  if (!response.ok) {
    let detail = "Failed to generate related words";
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
  return (await response.json()) as ContentItemRelatedResponse;
}

export async function generateContentItemCompareWords(
  itemId: number,
  sourceLanguage: StudyLanguageCode = "spanish",
  targetLanguage: StudyLanguageCode = "german",
): Promise<ContentItemCompareResponse> {
  const params = new URLSearchParams({
    source_language: sourceLanguage,
    target_language: targetLanguage,
  });
  const response = await apiFetch(
    `${API_BASE}/content/items/${itemId}/strategies/compare?${params.toString()}`,
    {
      method: "POST",
    },
  );
  if (!response.ok) {
    let detail = "Failed to generate comparisons";
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
  return (await response.json()) as ContentItemCompareResponse;
}

export async function generateContentItemVisualizePhrase(
  itemId: number,
  sourceLanguage: StudyLanguageCode = "spanish",
  targetLanguage: StudyLanguageCode = "german",
  stage: "full" | "phrase_only" | "image_only" = "full",
): Promise<ContentItemVisualizeResponse> {
  const params = new URLSearchParams({
    source_language: sourceLanguage,
    target_language: targetLanguage,
    stage,
  });
  const response = await apiFetch(
    `${API_BASE}/content/items/${itemId}/strategies/visualize?${params.toString()}`,
    {
      method: "POST",
    },
  );
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

export async function generateContentItemWalkSentences(
  itemId: number,
  sourceLanguage: StudyLanguageCode = "spanish",
  targetLanguage: StudyLanguageCode = "german",
): Promise<ContentItemWalkResponse> {
  const params = new URLSearchParams({
    source_language: sourceLanguage,
    target_language: targetLanguage,
  });
  const response = await apiFetch(
    `${API_BASE}/content/items/${itemId}/strategies/walk?${params.toString()}`,
    {
      method: "POST",
    },
  );
  if (!response.ok) {
    let detail = "Failed to generate walk exercise";
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
  return (await response.json()) as ContentItemWalkResponse;
}

export async function generateContentItemDecodeAnalysis(
  itemId: number,
  sourceLanguage: StudyLanguageCode = "spanish",
  targetLanguage: StudyLanguageCode = "german",
): Promise<ContentItemDecodeResponse> {
  const params = new URLSearchParams({
    source_language: sourceLanguage,
    target_language: targetLanguage,
  });
  const response = await apiFetch(
    `${API_BASE}/content/items/${itemId}/strategies/decode?${params.toString()}`,
    {
      method: "POST",
    },
  );
  if (!response.ok) {
    let detail = "Failed to generate decode analysis";
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
  return (await response.json()) as ContentItemDecodeResponse;
}

export async function generateContentItemEncounterSituations(
  itemId: number,
  sourceLanguage: StudyLanguageCode = "spanish",
  targetLanguage: StudyLanguageCode = "german",
): Promise<ContentItemEncounterResponse> {
  const params = new URLSearchParams({
    source_language: sourceLanguage,
    target_language: targetLanguage,
  });
  const response = await apiFetch(
    `${API_BASE}/content/items/${itemId}/strategies/encounter?${params.toString()}`,
    {
      method: "POST",
    },
  );
  if (!response.ok) {
    let detail = "Failed to generate encounter situations";
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
  return (await response.json()) as ContentItemEncounterResponse;
}
