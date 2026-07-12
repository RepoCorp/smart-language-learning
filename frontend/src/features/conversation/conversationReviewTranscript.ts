import type { ContentDialogRecord, ContentItemConversationResponse } from "../../types";

export type ConversationReviewTranscript = {
  dialog: ContentDialogRecord;
  originalUserTexts: Record<number, string>;
  correctedUserTexts: Record<number, string>;
};

export function buildFinishedConversationTranscript(
  topic: string,
  turns: ContentItemConversationResponse[],
): ConversationReviewTranscript {
  const reviewTurns: ContentDialogRecord["turns"] = [];
  const originalUserTexts: Record<number, string> = {};
  const correctedUserTexts: Record<number, string> = {};
  let reviewTurnIndex = 0;

  for (const turn of turns) {
    const userText = (turn.user_text || "").trim();
    const userTranslation = (turn.user_translation_text || "").trim();
    const correctedUserText = (turn.user_corrected_text || "").trim();
    const assistantText = (turn.assistant_text || "").trim();
    const assistantTranslation = (turn.assistant_translation_text || "").trim();

    if (userText) {
      reviewTurns.push({
        source_text: (turn.user_corrected_translation_text || "").trim(),
        target_text: correctedUserText,
        speaker: "a",
      });
      originalUserTexts[reviewTurnIndex] = userText;
      if (correctedUserText && correctedUserText !== userText) {
        correctedUserTexts[reviewTurnIndex] = correctedUserText;
      }
      reviewTurnIndex += 1;
    }

    if (assistantText) {
      reviewTurns.push({
        source_text: assistantTranslation,
        target_text: assistantText,
        speaker: "b",
      });
      reviewTurnIndex += 1;
    }
  }

  return {
    dialog: {
      dialog_id: 0,
      topic,
      context: "",
      audio_url: "",
      created_at: "",
      turn_count: reviewTurns.length,
      turns: reviewTurns,
    },
    originalUserTexts,
    correctedUserTexts,
  };
}

export function buildGeneratedReviewOriginalUserTexts(
  turns: ContentItemConversationResponse[],
): Record<number, string> {
  const originalUserTexts: Record<number, string> = {};
  let reviewTurnIndex = 0;

  for (const turn of turns) {
    const userText = (turn.user_text || "").trim();
    const assistantText = (turn.assistant_text || "").trim();

    if (userText) {
      originalUserTexts[reviewTurnIndex] = userText;
      reviewTurnIndex += 1;
    }
    if (assistantText) {
      reviewTurnIndex += 1;
    }
  }

  return originalUserTexts;
}
