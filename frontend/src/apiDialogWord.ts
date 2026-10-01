import type { DialogWordResult } from "./features/dialogs/components/wordAddPreview";
import type { StudyLanguageCode } from "./types";
import { API_BASE, apiFetch, notifyOverviewStatsUpdated } from "./apiCore";

export async function quickAddWordFromDialog(
  sourceText: string,
  targetText: string,
  sourceLanguage: StudyLanguageCode = "spanish",
  targetLanguage: StudyLanguageCode = "german",
  dialogId?: number,
  turnIndex?: number,
  checkOnly = false,
  sourceLine = "",
  targetLine = "",
  clickedTargetToken = "",
): Promise<DialogWordResult> {
  const params = new URLSearchParams({
    source_language: sourceLanguage,
    target_language: targetLanguage,
  });
  const response = await apiFetch(`${API_BASE}/content/words/add?${params.toString()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source_text: sourceText,
      target_text: targetText,
      notes: "",
      dialog_id: dialogId,
      turn_index: turnIndex,
      check_only: checkOnly,
      source_line: sourceLine,
      target_line: targetLine,
      clicked_target_token: clickedTargetToken,
    }),
  });
  if (!response.ok) {
    throw new Error("Failed to add word from dialog");
  }
  notifyOverviewStatsUpdated();
  return (await response.json()) as DialogWordResult;
}
