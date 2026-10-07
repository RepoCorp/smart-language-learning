import type { StudyLanguageCode } from "./types";
import { API_BASE, apiFetch, notifyOverviewStatsUpdated } from "./apiCore";

export async function quickAddPhraseFromConversation(
  sourceText: string,
  targetText: string,
  sourceLanguage: StudyLanguageCode = "spanish",
  targetLanguage: StudyLanguageCode = "german",
  checkOnly = false,
  dialogId?: number,
  turnIndex?: number,
  sourceLine = "",
  targetLine = "",
): Promise<{ created: boolean; exists: boolean; id?: number | null; source_text?: string; target_text?: string }> {
  const params = new URLSearchParams({
    source_language: sourceLanguage,
    target_language: targetLanguage,
  });
  const response = await apiFetch(`${API_BASE}/content/phrases/add?${params.toString()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source_text: sourceText,
      target_text: targetText,
      notes: "",
      check_only: checkOnly,
      dialog_id: dialogId,
      turn_index: turnIndex,
      source_line: sourceLine,
      target_line: targetLine,
    }),
  });
  if (!response.ok) {
    let detail = "Failed to add phrase from conversation";
    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload.detail) {
        detail = payload.detail;
      }
    } catch {
      // Keep generic detail when error body is not JSON.
    }
    throw new Error(detail);
  }
  notifyOverviewStatsUpdated();
  return (await response.json()) as {
    created: boolean;
    exists: boolean;
    id?: number | null;
    source_text?: string;
    target_text?: string;
  };
}
