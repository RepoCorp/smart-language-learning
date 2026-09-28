import { API_BASE, apiFetch, notifyOverviewStatsUpdated } from "./apiCore";

export type WordFormationProgress = { supported: boolean; saved: string[] };

export async function fetchWordFormationProgress(source: string, target: string): Promise<WordFormationProgress> {
  const query = new URLSearchParams({ source_language: source, target_language: target });
  const response = await apiFetch(`${API_BASE}/word-formation?${query}`);
  if (!response.ok) throw new Error("Could not load patterns");
  return response.json() as Promise<WordFormationProgress>;
}

export async function saveWordFormationPattern(pattern: string, source: string, target: string): Promise<void> {
  const response = await apiFetch(`${API_BASE}/word-formation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pattern_key: pattern, source_language: source, target_language: target }),
  });
  if (!response.ok) throw new Error("Could not save pattern");
  notifyOverviewStatsUpdated();
}
