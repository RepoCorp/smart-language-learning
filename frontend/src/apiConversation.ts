import { API_BASE, apiFetch } from "./apiCore";
import type { ContentItemConversationResponse, StudyLanguageCode } from "./types";

type ConversationAudioRequest = {
  topic: string;
  notes: string;
  roleText: string;
  goalText: string;
  conversationPhase: "active" | "closing";
  audioBlob: Blob;
  history: Array<{ user_text: string; assistant_text: string }>;
  voiceSeed: string;
  speechSpeed: "normal" | "slow" | "super_slow";
  responseLevel: "A1" | "A2" | "B1";
  sourceLanguage: StudyLanguageCode;
  targetLanguage: StudyLanguageCode;
};

export async function sendTopicConversationAudio({
  topic,
  notes,
  roleText,
  goalText,
  conversationPhase,
  audioBlob,
  history,
  voiceSeed,
  speechSpeed,
  responseLevel,
  sourceLanguage,
  targetLanguage,
}: ConversationAudioRequest): Promise<ContentItemConversationResponse> {
  const params = new URLSearchParams({
    source_language: sourceLanguage,
    target_language: targetLanguage,
  });
  const formData = new FormData();
  const audioType = (audioBlob.type || "").toLowerCase();
  let audioFilename = "speech.webm";
  if (audioType.includes("mp4") || audioType.includes("m4a")) {
    audioFilename = "speech.m4a";
  } else if (audioType.includes("wav")) {
    audioFilename = "speech.wav";
  } else if (audioType.includes("mpeg") || audioType.includes("mp3")) {
    audioFilename = "speech.mp3";
  } else if (audioType.includes("ogg")) {
    audioFilename = "speech.ogg";
  }
  formData.append("audio", audioBlob, audioFilename);
  formData.append("history", JSON.stringify(history));
  formData.append("topic", topic);
  formData.append("notes", notes);
  formData.append("role_text", roleText);
  formData.append("goal_text", goalText);
  formData.append("conversation_phase", conversationPhase);
  formData.append("skip_goal_evaluation", "true");
  formData.append("speech_speed", speechSpeed);
  formData.append("response_level", responseLevel);
  formData.append("voice_seed", voiceSeed);

  const response = await apiFetch(`${API_BASE}/content/conversation/turn?${params.toString()}`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    let detail = "Failed to process conversation audio";
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
  return (await response.json()) as ContentItemConversationResponse;
}
