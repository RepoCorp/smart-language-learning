import type {
  ContentConfirmResponse,
  ContentPreviewResponse,
  ContentTopicContextsResponse,
  ContentTopicsResponse,
  OverviewStatsResponse,
  ReviewDirection,
  SessionResponse,
} from "./types";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
const OVERVIEW_STATS_UPDATED_EVENT = "overview-stats-updated";

function notifyOverviewStatsUpdated(): void {
  window.dispatchEvent(new CustomEvent(OVERVIEW_STATS_UPDATED_EVENT));
}

export function getOverviewStatsUpdatedEventName(): string {
  return OVERVIEW_STATS_UPDATED_EVENT;
}

export async function fetchSession(size = 5): Promise<SessionResponse> {
  const response = await fetch(`${API_BASE}/session?size=${size}`);
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

export async function previewContent(topic: string, context = ""): Promise<ContentPreviewResponse> {
  const response = await fetch(`${API_BASE}/content/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic, context }),
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
): Promise<ContentConfirmResponse> {
  const response = await fetch(`${API_BASE}/content/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      topic,
      context,
      selected_phrases: selectedPhrases,
      selected_words: selectedWords,
    }),
  });
  if (!response.ok) {
    throw new Error("Failed to save generated content");
  }
  notifyOverviewStatsUpdated();
  return (await response.json()) as ContentConfirmResponse;
}

export async function fetchContentTopics(): Promise<ContentTopicsResponse> {
  const response = await fetch(`${API_BASE}/content/topics`);
  if (!response.ok) {
    throw new Error("Failed to load previous topics");
  }
  return (await response.json()) as ContentTopicsResponse;
}

export async function fetchContentTopicContexts(topic: string): Promise<ContentTopicContextsResponse> {
  const params = new URLSearchParams({ topic });
  const response = await fetch(`${API_BASE}/content/topic-contexts?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to load topic contexts");
  }
  return (await response.json()) as ContentTopicContextsResponse;
}

export async function fetchOverviewStats(): Promise<OverviewStatsResponse> {
  const response = await fetch(`${API_BASE}/overview-stats`);
  if (!response.ok) {
    throw new Error("Failed to load overview stats");
  }
  return (await response.json()) as OverviewStatsResponse;
}
