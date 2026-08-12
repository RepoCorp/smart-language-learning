import { API_BASE, apiFetch, notifyLearningProgressUpdated } from "./apiCore";
import type { LearningProgressResponse, StudyLanguageCode } from "./types";

function languageParams(sourceLanguage: StudyLanguageCode, targetLanguage: StudyLanguageCode): string {
  return new URLSearchParams({ source_language: sourceLanguage, target_language: targetLanguage }).toString();
}

async function parseProgress(response: Response): Promise<LearningProgressResponse> {
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(String(payload.detail || "Failed to update learning progress"));
  }
  const progress = await response.json() as LearningProgressResponse;
  notifyLearningProgressUpdated();
  return progress;
}

export async function fetchLearningProgress(
  sourceLanguage: StudyLanguageCode,
  targetLanguage: StudyLanguageCode,
): Promise<LearningProgressResponse> {
  const response = await apiFetch(`${API_BASE}/progress?${languageParams(sourceLanguage, targetLanguage)}`);
  if (!response.ok) {
    throw new Error("Failed to load learning progress");
  }
  return (await response.json()) as LearningProgressResponse;
}

export async function recordLearningStudyTime(
  seconds: number,
  sourceLanguage: StudyLanguageCode,
  targetLanguage: StudyLanguageCode,
): Promise<LearningProgressResponse> {
  const response = await apiFetch(`${API_BASE}/progress/study-time?${languageParams(sourceLanguage, targetLanguage)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ seconds }),
  });
  return parseProgress(response);
}

export async function createLearningStreakPause(
  startDate: string,
  endDate: string,
  sourceLanguage: StudyLanguageCode,
  targetLanguage: StudyLanguageCode,
): Promise<LearningProgressResponse> {
  const response = await apiFetch(`${API_BASE}/progress/pause?${languageParams(sourceLanguage, targetLanguage)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ start_date: startDate, end_date: endDate }),
  });
  return parseProgress(response);
}

export async function resumeLearningStreak(
  sourceLanguage: StudyLanguageCode,
  targetLanguage: StudyLanguageCode,
): Promise<LearningProgressResponse> {
  const response = await apiFetch(`${API_BASE}/progress/resume?${languageParams(sourceLanguage, targetLanguage)}`, { method: "POST" });
  return parseProgress(response);
}
