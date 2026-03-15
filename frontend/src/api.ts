import type { ReviewDirection, SessionResponse } from "./types";

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
