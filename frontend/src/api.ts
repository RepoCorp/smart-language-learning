import type {
  ContentConfirmResponse,
  ContentItemsResponse,
  ContentItemDetailResponse,
  ContentPreviewResponse,
  ContentTopicContextsResponse,
  ContentTopicsResponse,
  OverviewStatsResponse,
  ReviewDirection,
  SessionResponse,
  StudyLanguageCode,
} from "./types";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
const OVERVIEW_STATS_UPDATED_EVENT = "overview-stats-updated";

function notifyOverviewStatsUpdated(): void {
  window.dispatchEvent(new CustomEvent(OVERVIEW_STATS_UPDATED_EVENT));
}

export function getOverviewStatsUpdatedEventName(): string {
  return OVERVIEW_STATS_UPDATED_EVENT;
}

export async function fetchSession(
  size = 5,
  sourceLanguage: StudyLanguageCode = "spanish",
  targetLanguage: StudyLanguageCode = "german",
  durationMinutes?: number,
): Promise<SessionResponse> {
  const params = new URLSearchParams({
    size: String(size),
    source_language: sourceLanguage,
    target_language: targetLanguage,
  });
  if (durationMinutes !== undefined) {
    params.set("duration_minutes", String(durationMinutes));
  }
  const response = await fetch(`${API_BASE}/session?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to load session");
  }
  return (await response.json()) as SessionResponse;
}

export async function submitReview(itemId: number, correct: boolean, direction?: ReviewDirection | null): Promise<void> {
  const payload: { item_id: number; correct: boolean; direction?: ReviewDirection } = { item_id: itemId, correct };
  if (direction) {
    payload.direction = direction;
  }

  const response = await fetch(`${API_BASE}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Failed to submit answer");
  }
  notifyOverviewStatsUpdated();
}

export async function markSeen(itemId: number): Promise<void> {
  const response = await fetch(`${API_BASE}/seen`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item_id: itemId }),
  });

  if (!response.ok) {
    throw new Error("Failed to mark item as seen");
  }
  notifyOverviewStatsUpdated();
}

export async function previewContent(
  topic: string,
  context = "",
  sourceLanguage: StudyLanguageCode = "spanish",
  targetLanguage: StudyLanguageCode = "german",
): Promise<ContentPreviewResponse> {
  const response = await fetch(`${API_BASE}/content/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      topic,
      context,
      source_language: sourceLanguage,
      target_language: targetLanguage,
    }),
  });
  if (!response.ok) {
    throw new Error("Failed to generate content preview");
  }
  return (await response.json()) as ContentPreviewResponse;
}

export async function confirmContent(
  topic: string,
  selectedPhrases: string[],
  selectedWords: string[],
  context = "",
  sourceLanguage: StudyLanguageCode = "spanish",
  targetLanguage: StudyLanguageCode = "german",
  createDialogAudio = false,
  previewPhrases: Array<{ spanish_text: string; german_text: string; notes?: string }> = [],
  previewWords: Array<{ spanish_text: string; german_text: string; notes?: string }> = [],
): Promise<ContentConfirmResponse> {
  const response = await fetch(`${API_BASE}/content/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      topic,
      context,
      source_language: sourceLanguage,
      target_language: targetLanguage,
      create_dialog_audio: createDialogAudio,
      selected_phrases: selectedPhrases,
      selected_words: selectedWords,
      preview_phrases: previewPhrases,
      preview_words: previewWords,
    }),
  });
  if (!response.ok) {
    throw new Error("Failed to save generated content");
  }
  notifyOverviewStatsUpdated();
  return (await response.json()) as ContentConfirmResponse;
}

export async function fetchContentTopics(
  sourceLanguage: StudyLanguageCode = "spanish",
  targetLanguage: StudyLanguageCode = "german",
): Promise<ContentTopicsResponse> {
  const params = new URLSearchParams({
    source_language: sourceLanguage,
    target_language: targetLanguage,
  });
  const response = await fetch(`${API_BASE}/content/topics?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to load previous topics");
  }
  return (await response.json()) as ContentTopicsResponse;
}

export async function fetchContentItems(
  sourceLanguage: StudyLanguageCode = "spanish",
  targetLanguage: StudyLanguageCode = "german",
): Promise<ContentItemsResponse> {
  const params = new URLSearchParams({
    source_language: sourceLanguage,
    target_language: targetLanguage,
  });
  const response = await fetch(`${API_BASE}/content/items?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to load saved items");
  }
  return (await response.json()) as ContentItemsResponse;
}

export async function fetchContentTopicContexts(
  topic: string,
  sourceLanguage: StudyLanguageCode = "spanish",
  targetLanguage: StudyLanguageCode = "german",
): Promise<ContentTopicContextsResponse> {
  const params = new URLSearchParams({
    topic,
    source_language: sourceLanguage,
    target_language: targetLanguage,
  });
  const response = await fetch(`${API_BASE}/content/topic-contexts?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to load topic contexts");
  }
  return (await response.json()) as ContentTopicContextsResponse;
}

export async function fetchContentItemDetail(
  itemId: number,
  sourceLanguage: StudyLanguageCode = "spanish",
  targetLanguage: StudyLanguageCode = "german",
): Promise<ContentItemDetailResponse> {
  const params = new URLSearchParams({
    source_language: sourceLanguage,
    target_language: targetLanguage,
  });
  const response = await fetch(`${API_BASE}/content/items/${itemId}?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to load content item detail");
  }
  return (await response.json()) as ContentItemDetailResponse;
}

export async function deleteContentItem(
  itemId: number,
  sourceLanguage: StudyLanguageCode = "spanish",
  targetLanguage: StudyLanguageCode = "german",
): Promise<void> {
  const params = new URLSearchParams({
    source_language: sourceLanguage,
    target_language: targetLanguage,
  });
  const response = await fetch(`${API_BASE}/content/items/${itemId}?${params.toString()}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error("Failed to delete item");
  }
  notifyOverviewStatsUpdated();
}

export async function regenerateContentItemAudio(
  itemId: number,
  sourceLanguage: StudyLanguageCode = "spanish",
  targetLanguage: StudyLanguageCode = "german",
): Promise<string> {
  const params = new URLSearchParams({
    source_language: sourceLanguage,
    target_language: targetLanguage,
  });
  const response = await fetch(`${API_BASE}/content/items/${itemId}?${params.toString()}`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error("Failed to regenerate item audio");
  }
  const payload = (await response.json()) as { audio_url?: string };
  return payload.audio_url || "";
}

export async function setContentItemLearned(
  itemId: number,
  isLearned: boolean,
  sourceLanguage: StudyLanguageCode = "spanish",
  targetLanguage: StudyLanguageCode = "german",
): Promise<void> {
  const params = new URLSearchParams({
    source_language: sourceLanguage,
    target_language: targetLanguage,
  });
  const response = await fetch(`${API_BASE}/content/items/${itemId}/mark-learned?${params.toString()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_learned: isLearned }),
  });
  if (!response.ok) {
    throw new Error("Failed to update item learned status");
  }
  notifyOverviewStatsUpdated();
}

export async function deleteContentTopic(
  topic: string,
  sourceLanguage: StudyLanguageCode = "spanish",
  targetLanguage: StudyLanguageCode = "german",
): Promise<void> {
  const response = await fetch(`${API_BASE}/content/topics/delete`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      topic,
      source_language: sourceLanguage,
      target_language: targetLanguage,
    }),
  });
  if (!response.ok) {
    throw new Error("Failed to delete topic");
  }
}

export async function fetchOverviewStats(
  sourceLanguage: StudyLanguageCode = "spanish",
  targetLanguage: StudyLanguageCode = "german",
): Promise<OverviewStatsResponse> {
  const params = new URLSearchParams({
    source_language: sourceLanguage,
    target_language: targetLanguage,
  });
  const response = await fetch(`${API_BASE}/overview-stats?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to load overview stats");
  }
  return (await response.json()) as OverviewStatsResponse;
}
