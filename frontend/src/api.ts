import type {
  ContentConfirmResponse,
  ContentPreviewResponse,
  ReviewDirection,
  SessionResponse,
} from "./types";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

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
}

export async function previewContent(topic: string): Promise<ContentPreviewResponse> {
  const response = await fetch(`${API_BASE}/content/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic }),
  });
  if (!response.ok) {
    throw new Error("Failed to generate content preview");
  }
  return (await response.json()) as ContentPreviewResponse;
}

export async function confirmContent(topic: string, selectedWords: string[]): Promise<ContentConfirmResponse> {
  const response = await fetch(`${API_BASE}/content/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      topic,
      selected_words: selectedWords,
    }),
  });
  if (!response.ok) {
    throw new Error("Failed to save generated content");
  }
  return (await response.json()) as ContentConfirmResponse;
}
