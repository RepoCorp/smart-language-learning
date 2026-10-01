import { API_BASE, apiFetch, notifyOverviewStatsUpdated } from "./apiCore";

export async function saveConstructionPattern(saveToken: string): Promise<number> {
  const response = await apiFetch(`${API_BASE}/construction-patterns`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ save_token: saveToken }),
  });
  if (!response.ok) throw new Error("Could not save construction pattern");
  const result = await response.json() as { id: number };
  if (!Number.isInteger(result.id) || result.id <= 0) throw new Error("Invalid saved pattern response");
  notifyOverviewStatsUpdated();
  return result.id;
}
