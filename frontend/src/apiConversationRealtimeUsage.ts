import { API_BASE, apiFetch } from "./apiCore";

type RealtimeUsageResponse = {
  recorded_seconds: number;
  remaining_seconds: number;
};

export async function recordTopicConversationRealtimeUsage(activeSeconds: number): Promise<RealtimeUsageResponse> {
  const response = await apiFetch(`${API_BASE}/content/conversation/realtime-usage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ active_seconds: Math.max(0, Math.round(activeSeconds)) }),
  });
  if (!response.ok) {
    throw new Error("Failed to record live conversation usage");
  }
  return (await response.json()) as RealtimeUsageResponse;
}
