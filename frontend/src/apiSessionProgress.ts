import { API_BASE, apiFetch, notifyLearningProgressUpdated, notifyOverviewStatsUpdated } from "./apiCore";

type MarkSessionItemSeenResponse = {
  new_items_completed_today: number;
  show_new_items_celebration: boolean;
};

export async function markSessionItemSeen(itemId: number): Promise<MarkSessionItemSeenResponse> {
  const response = await apiFetch(`${API_BASE}/seen`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item_id: itemId }),
  });
  if (!response.ok) {
    let detail = "Failed to mark item as seen";
    try {
      const payload = (await response.json()) as { detail?: string };
      detail = payload.detail || detail;
    } catch {
      // Preserve the generic message when the error body cannot be read.
    }
    throw new Error(detail);
  }
  notifyOverviewStatsUpdated();
  notifyLearningProgressUpdated();
  return (await response.json()) as MarkSessionItemSeenResponse;
}
