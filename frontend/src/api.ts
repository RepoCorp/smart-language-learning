import type {
  ContentConfirmResponse,
  ContentDialogRecord,
  ContentDialogsResponse,
  ContentItemsResponse,
  ContentItemDetailResponse,
  ContentItemRefreshWordResponse,
  ContentItemConversationResponse,
  ContentItemQuestionResponse,
  ContentPreviewResponse,
  CompareWordRecord,
  ContentTopicContextsResponse,
  TopicConversationStartResponse,
  TopicConversationHelpResponse,
  ContentTopicsResponse,
  ItemExercisePhrases,
  OverviewStatsResponse,
  ReviewDirection,
  SessionResponse,
  SessionRestoreState,
  StudyLanguageCode,
} from "./types";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
const AUTH_TOKEN_KEY = "smart-language-learning-auth-token";
const AUTH_USER_KEY = "smart-language-learning-auth-user";
const OVERVIEW_STATS_UPDATED_EVENT = "overview-stats-updated";

export type AuthUser = {
  id: number;
  username: string;
  email: string;
  is_superuser: boolean;
};

function notifyOverviewStatsUpdated(): void {
  window.dispatchEvent(new CustomEvent(OVERVIEW_STATS_UPDATED_EVENT));
}

function apiRequestSummary(input: string, init?: RequestInit): { method: string; url: string } {
  return {
    method: init?.method || "GET",
    url: typeof input === "string" ? input : input.toString(),
  };
}

function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const token = getAuthToken();
  const headers = new Headers(init?.headers || {});
  headers.set("Accept", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const request = apiRequestSummary(input, init);
  return fetch(input, { ...init, headers })
    .then((response) => {
      if (!response.ok) {
        console.error("Backend request failed", {
          ...request,
          status: response.status,
          statusText: response.statusText,
        });
      }
      const contentType = response.headers.get("Content-Type") || "";
      if (response.ok && contentType.includes("text/html")) {
        console.error("Backend request returned HTML instead of JSON. Check VITE_API_URL/BACKEND_API_URL and ALB routing.", {
          ...request,
          status: response.status,
          contentType,
        });
      }
      return response;
    })
    .catch((error) => {
      console.error("Backend request error", {
        ...request,
        error,
      });
      throw error;
    });
}

export function getAuthToken(): string {
  return window.localStorage.getItem(AUTH_TOKEN_KEY) || "";
}

export function getStoredAuthUser(): AuthUser | null {
  try {
    const raw = window.localStorage.getItem(AUTH_USER_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as AuthUser;
    if (!parsed || typeof parsed.id !== "number") {
      return null;
    }
    if (typeof parsed.is_superuser !== "boolean") {
      return { ...parsed, is_superuser: false };
    }
    return parsed;
  } catch {
    return null;
  }
}

function storeAuthSession(token: string, user: AuthUser): void {
  window.localStorage.setItem(AUTH_TOKEN_KEY, token);
  window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

function clearStoredAuthSession(): void {
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  window.localStorage.removeItem(AUTH_USER_KEY);
}

export function getOverviewStatsUpdatedEventName(): string {
  return OVERVIEW_STATS_UPDATED_EVENT;
}

export async function loginWithPin(identifier: string, pin: string): Promise<AuthUser> {
  const response = await apiFetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, pin }),
  });
  if (!response.ok) {
    throw new Error("Invalid credentials");
  }
  const payload = (await response.json()) as { token: string; user: AuthUser };
  storeAuthSession(payload.token, payload.user);
  notifyOverviewStatsUpdated();
  return payload.user;
}

export async function registerWithPin(username: string, email: string, pin: string): Promise<AuthUser> {
  const response = await apiFetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, pin }),
  });
  if (!response.ok) {
    let detail = "Failed to create user";
    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload.detail) {
        detail = payload.detail;
      }
    } catch {
      // Keep default message.
    }
    throw new Error(detail);
  }
  const payload = (await response.json()) as { token?: string; user: AuthUser };
  if (payload.token) {
    storeAuthSession(payload.token, payload.user);
    notifyOverviewStatsUpdated();
  }
  return payload.user;
}

export async function createUserWithPin(username: string, email: string, pin: string): Promise<AuthUser> {
  const response = await apiFetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, pin }),
  });
  if (!response.ok) {
    let detail = "Failed to create user";
    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload.detail) {
        detail = payload.detail;
      }
    } catch {
      // Keep default message.
    }
    throw new Error(detail);
  }
  const payload = (await response.json()) as { user: AuthUser };
  return payload.user;
}

export async function logoutFromPinSession(): Promise<void> {
  await apiFetch(`${API_BASE}/auth/logout`, { method: "POST" });
  clearStoredAuthSession();
  notifyOverviewStatsUpdated();
}

export async function fetchAuthBootstrapStatus(): Promise<boolean> {
  const response = await apiFetch(`${API_BASE}/auth/bootstrap-status`);
  if (!response.ok) {
    return false;
  }
  const payload = (await response.json()) as { can_public_register?: boolean };
  return Boolean(payload.can_public_register);
}

export async function fetchSession(
  size = 5,
  sourceLanguage: StudyLanguageCode = "spanish",
  targetLanguage: StudyLanguageCode = "german",
  durationMinutes?: number,
): Promise<SessionResponse> {
  const params = new URLSearchParams({
    size: String(size),
    source_language: sourceLanguage,
    target_language: targetLanguage,
  });
  if (durationMinutes !== undefined) {
    params.set("duration_minutes", String(durationMinutes));
  }
  const response = await apiFetch(`${API_BASE}/session?${params.toString()}`);
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

  const response = await apiFetch(`${API_BASE}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let detail = "Failed to submit answer";
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
}

export async function markSeen(itemId: number): Promise<void> {
  const response = await apiFetch(`${API_BASE}/seen`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item_id: itemId }),
  });

  if (!response.ok) {
    let detail = "Failed to mark item as seen";
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
}

export async function restoreSessionItemState(itemId: number, state: SessionRestoreState): Promise<void> {
  const response = await apiFetch(`${API_BASE}/session/restore-item-state`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item_id: itemId, state }),
  });

  if (!response.ok) {
    let detail = "Failed to restore previous session item";
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
}

export async function completeDifficultItem(itemId: number): Promise<void> {
  const response = await apiFetch(`${API_BASE}/difficult-items/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item_id: itemId }),
  });

  if (!response.ok) {
    let detail = "Failed to complete difficult item";
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
}

export async function previewContent(
  topic: string,
  context = "",
  conversationDetails = "",
  requiredWords = "",
  requiredWordsLanguage: "source" | "target" = "target",
  dialogLength: "standard" | "short_three" = "standard",
  sourceLanguage: StudyLanguageCode = "spanish",
  targetLanguage: StudyLanguageCode = "german",
): Promise<ContentPreviewResponse> {
  const response = await apiFetch(`${API_BASE}/content/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      topic,
      context,
      conversation_details: conversationDetails,
      required_words: requiredWords,
      required_words_language: requiredWordsLanguage,
      dialog_length: dialogLength,
      source_language: sourceLanguage,
      target_language: targetLanguage,
    }),
  });
  if (!response.ok) {
    throw new Error("Failed to generate content preview");
  }
  return (await response.json()) as ContentPreviewResponse;
}

export async function confirmContent(
  topic: string,
  dialogTurns: Array<{ source_text: string; target_text: string; speaker?: "a" | "b" }>,
  context = "",
  sourceLanguage: StudyLanguageCode = "spanish",
  targetLanguage: StudyLanguageCode = "german",
  selectedTurnIndexes?: number[],
): Promise<ContentConfirmResponse> {
  const response = await apiFetch(`${API_BASE}/content/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      topic,
      context,
      source_language: sourceLanguage,
      target_language: targetLanguage,
      dialog_turns: dialogTurns,
      selected_turn_indexes: selectedTurnIndexes,
    }),
  });
  if (!response.ok) {
    throw new Error("Failed to save generated content");
  }
  notifyOverviewStatsUpdated();
  return (await response.json()) as ContentConfirmResponse;
}

export async function fetchContentTopics(
  sourceLanguage: StudyLanguageCode = "spanish",
  targetLanguage: StudyLanguageCode = "german",
  page = 1,
  pageSize = 25,
  query = "",
): Promise<ContentTopicsResponse> {
  const params = new URLSearchParams({
    source_language: sourceLanguage,
    target_language: targetLanguage,
    page: String(page),
    page_size: String(pageSize),
  });
  if (query.trim()) {
    params.set("q", query.trim());
  }
  const response = await apiFetch(`${API_BASE}/content/topics?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to load previous topics");
  }
  return (await response.json()) as ContentTopicsResponse;
}

export async function fetchContentItems(
  sourceLanguage: StudyLanguageCode = "spanish",
  targetLanguage: StudyLanguageCode = "german",
  section = "all",
  page = 1,
  pageSize = 25,
  query = "",
): Promise<ContentItemsResponse> {
  const params = new URLSearchParams({
    source_language: sourceLanguage,
    target_language: targetLanguage,
    section,
    page: String(page),
    page_size: String(pageSize),
  });
  if (query.trim()) {
    params.set("q", query.trim());
  }
  const response = await apiFetch(`${API_BASE}/content/items?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to load saved items");
  }
  return (await response.json()) as ContentItemsResponse;
}

export async function fetchContentDialogs(
  sourceLanguage: StudyLanguageCode = "spanish",
  targetLanguage: StudyLanguageCode = "german",
  page = 1,
  pageSize = 20,
  topic = "",
  context = "",
): Promise<ContentDialogsResponse> {
  const params = new URLSearchParams({
    source_language: sourceLanguage,
    target_language: targetLanguage,
    page: String(page),
    page_size: String(pageSize),
  });
  if (topic.trim()) {
    params.set("topic", topic.trim());
  }
  if (context.trim()) {
    params.set("context", context.trim());
  }
  const response = await apiFetch(`${API_BASE}/content/dialogs?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to load saved dialogs");
  }
  return (await response.json()) as ContentDialogsResponse;
}

export async function fetchContentDialogDetail(
  dialogId: number,
  sourceLanguage: StudyLanguageCode = "spanish",
  targetLanguage: StudyLanguageCode = "german",
): Promise<ContentDialogRecord> {
  const params = new URLSearchParams({
    source_language: sourceLanguage,
    target_language: targetLanguage,
  });
  const response = await apiFetch(`${API_BASE}/content/dialogs/${dialogId}?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to load saved dialog");
  }
  return (await response.json()) as ContentDialogRecord;
}

export async function generateContentDialogTurnAudio(
  dialogId: number,
  turnIndex: number,
  sourceLanguage: StudyLanguageCode = "spanish",
  targetLanguage: StudyLanguageCode = "german",
): Promise<string> {
  const params = new URLSearchParams({
    source_language: sourceLanguage,
    target_language: targetLanguage,
  });
  const response = await apiFetch(`${API_BASE}/content/dialogs/${dialogId}/turns/${turnIndex}/audio?${params.toString()}`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error("Failed to generate dialog turn audio");
  }
  const payload = (await response.json()) as { audio_url?: string };
  return payload.audio_url || "";
}

export async function regenerateContentDialogAudio(
  dialogId: number,
  sourceLanguage: StudyLanguageCode = "spanish",
  targetLanguage: StudyLanguageCode = "german",
): Promise<ContentDialogRecord> {
  const params = new URLSearchParams({
    source_language: sourceLanguage,
    target_language: targetLanguage,
  });
  const response = await apiFetch(`${API_BASE}/content/dialogs/${dialogId}/audio?${params.toString()}`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error("Failed to regenerate dialog audio");
  }
  return (await response.json()) as ContentDialogRecord;
}

export async function fetchContentTopicContexts(
  topic: string,
  sourceLanguage: StudyLanguageCode = "spanish",
  targetLanguage: StudyLanguageCode = "german",
): Promise<ContentTopicContextsResponse> {
  const params = new URLSearchParams({
    topic,
    source_language: sourceLanguage,
    target_language: targetLanguage,
  });
  const response = await apiFetch(`${API_BASE}/content/topic-contexts?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to load topic contexts");
  }
  return (await response.json()) as ContentTopicContextsResponse;
}

export async function fetchContentItemDetail(
  itemId: number,
  sourceLanguage: StudyLanguageCode = "spanish",
  targetLanguage: StudyLanguageCode = "german",
): Promise<ContentItemDetailResponse> {
  const params = new URLSearchParams({
    source_language: sourceLanguage,
    target_language: targetLanguage,
  });
  const response = await apiFetch(`${API_BASE}/content/items/${itemId}?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to load content item detail");
  }
  return (await response.json()) as ContentItemDetailResponse;
}

export async function searchContentItemCompareWords(
  itemId: number,
  query = "",
  page = 1,
  pageSize = 10,
  sourceLanguage: StudyLanguageCode = "spanish",
  targetLanguage: StudyLanguageCode = "german",
): Promise<{ items: CompareWordRecord[]; page?: number; page_size?: number; has_more?: boolean; next_page?: number | null; query?: string }> {
  const params = new URLSearchParams({
    source_language: sourceLanguage,
    target_language: targetLanguage,
    q: query,
    page: String(page),
    page_size: String(pageSize),
  });
  const response = await apiFetch(`${API_BASE}/content/items/${itemId}/compare-words/search?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to search compare words");
  }
  return (await response.json()) as { items: CompareWordRecord[]; page?: number; page_size?: number; has_more?: boolean; next_page?: number | null; query?: string };
}

export async function addContentItemCompareWords(
  itemId: number,
  wordIds: number[],
  sourceLanguage: StudyLanguageCode = "spanish",
  targetLanguage: StudyLanguageCode = "german",
): Promise<{ compare_words?: CompareWordRecord[] }> {
  const params = new URLSearchParams({
    source_language: sourceLanguage,
    target_language: targetLanguage,
  });
  const response = await apiFetch(`${API_BASE}/content/items/${itemId}/compare-words?${params.toString()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ word_ids: wordIds }),
  });
  if (!response.ok) {
    throw new Error("Failed to add compare words");
  }
  return (await response.json()) as { compare_words?: CompareWordRecord[] };
}

export async function removeContentItemCompareWord(
  itemId: number,
  linkedItemId: number,
  sourceLanguage: StudyLanguageCode = "spanish",
  targetLanguage: StudyLanguageCode = "german",
): Promise<{ compare_words?: CompareWordRecord[] }> {
  const params = new URLSearchParams({
    source_language: sourceLanguage,
    target_language: targetLanguage,
  });
  const response = await apiFetch(`${API_BASE}/content/items/${itemId}/compare-words/${linkedItemId}?${params.toString()}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error("Failed to remove compare word");
  }
  return (await response.json()) as { compare_words?: CompareWordRecord[] };
}

export async function generateContentItemExercises(
  itemId: number,
  sourceLanguage: StudyLanguageCode = "spanish",
  targetLanguage: StudyLanguageCode = "german",
): Promise<{ exercise_phrases?: ItemExercisePhrases }> {
  const params = new URLSearchParams({
    source_language: sourceLanguage,
    target_language: targetLanguage,
  });
  const response = await apiFetch(`${API_BASE}/content/items/${itemId}/exercises?${params.toString()}`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error("Failed to generate word exercises");
  }
  return (await response.json()) as { exercise_phrases?: ItemExercisePhrases };
}

export async function generateContentItemFunnyImageExercise(
  itemId: number,
  sourceLanguage: StudyLanguageCode = "spanish",
  targetLanguage: StudyLanguageCode = "german",
): Promise<{ exercise_phrases?: ItemExercisePhrases }> {
  const params = new URLSearchParams({
    source_language: sourceLanguage,
    target_language: targetLanguage,
  });
  const response = await apiFetch(`${API_BASE}/content/items/${itemId}/exercises/funny-image?${params.toString()}`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error("Failed to generate funny image exercise");
  }
  return (await response.json()) as { exercise_phrases?: ItemExercisePhrases };
}

export async function refreshContentItemWord(
  itemId: number,
  sourceLanguage: StudyLanguageCode = "spanish",
  targetLanguage: StudyLanguageCode = "german",
): Promise<ContentItemRefreshWordResponse> {
  const params = new URLSearchParams({
    source_language: sourceLanguage,
    target_language: targetLanguage,
  });
  const response = await apiFetch(`${API_BASE}/content/items/${itemId}/refresh-word?${params.toString()}`, {
    method: "POST",
  });
  if (!response.ok) {
    let detail = "Failed to refresh word";
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
  return (await response.json()) as ContentItemRefreshWordResponse;
}

export async function deleteContentItem(
  itemId: number,
  sourceLanguage: StudyLanguageCode = "spanish",
  targetLanguage: StudyLanguageCode = "german",
): Promise<void> {
  const params = new URLSearchParams({
    source_language: sourceLanguage,
    target_language: targetLanguage,
  });
  const response = await apiFetch(`${API_BASE}/content/items/${itemId}?${params.toString()}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error("Failed to delete item");
  }
  notifyOverviewStatsUpdated();
}

export async function regenerateContentItemAudio(
  itemId: number,
  sourceLanguage: StudyLanguageCode = "spanish",
  targetLanguage: StudyLanguageCode = "german",
): Promise<string> {
  const params = new URLSearchParams({
    source_language: sourceLanguage,
    target_language: targetLanguage,
  });
  const response = await apiFetch(`${API_BASE}/content/items/${itemId}?${params.toString()}`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error("Failed to regenerate item audio");
  }
  const payload = (await response.json()) as { audio_url?: string };
  return payload.audio_url || "";
}

export async function setContentItemLearned(
  itemId: number,
  isLearned: boolean,
  sourceLanguage: StudyLanguageCode = "spanish",
  targetLanguage: StudyLanguageCode = "german",
): Promise<void> {
  const params = new URLSearchParams({
    source_language: sourceLanguage,
    target_language: targetLanguage,
  });
  const response = await apiFetch(`${API_BASE}/content/items/${itemId}/mark-learned?${params.toString()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_learned: isLearned }),
  });
  if (!response.ok) {
    let detail = "Failed to update item learned status";
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
}

export async function askContentItemQuestion(
  itemId: number,
  questionText: string,
  conversationHistory: Array<{ question_text: string; answer_text: string; created_at?: string }> = [],
  sourceLanguage: StudyLanguageCode = "spanish",
  targetLanguage: StudyLanguageCode = "german",
): Promise<ContentItemQuestionResponse> {
  const params = new URLSearchParams({
    source_language: sourceLanguage,
    target_language: targetLanguage,
  });
  const response = await apiFetch(`${API_BASE}/content/items/${itemId}/question?${params.toString()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question_text: questionText, conversation_history: conversationHistory }),
  });
  if (!response.ok) {
    let detail = "Failed to answer item question";
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
  return (await response.json()) as ContentItemQuestionResponse;
}

export async function startTopicConversation(
  topic: string,
  notes: string,
  roleText: string,
  goalDifficulty: "easy" | "medium" | "hard",
  sourceLanguage: StudyLanguageCode = "spanish",
  targetLanguage: StudyLanguageCode = "german",
): Promise<TopicConversationStartResponse> {
  const params = new URLSearchParams({
    source_language: sourceLanguage,
    target_language: targetLanguage,
  });
  const response = await apiFetch(`${API_BASE}/content/conversation/start?${params.toString()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic, notes, role_text: roleText, goal_difficulty: goalDifficulty }),
  });
  if (!response.ok) {
    let detail = "Failed to start conversation";
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
  return (await response.json()) as TopicConversationStartResponse;
}

export async function sendTopicConversationAudio(
  topic: string,
  notes: string,
  roleText: string,
  goalText: string,
  audioBlob: Blob,
  history: Array<{ user_text: string; assistant_text: string }>,
  sourceLanguage: StudyLanguageCode = "spanish",
  targetLanguage: StudyLanguageCode = "german",
): Promise<ContentItemConversationResponse> {
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

export async function sendTopicConversationHelpRequest(
  topic: string,
  notes: string,
  roleText: string,
  requestText: string,
  history: Array<{ user_text: string; assistant_text: string }>,
  requestKind: "coach" | "say" = "coach",
  sourceLanguage: StudyLanguageCode = "spanish",
  targetLanguage: StudyLanguageCode = "german",
): Promise<TopicConversationHelpResponse> {
  const params = new URLSearchParams({
    source_language: sourceLanguage,
    target_language: targetLanguage,
  });
  const response = await apiFetch(`${API_BASE}/content/conversation/help?${params.toString()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      topic,
      notes,
      role_text: roleText,
      request_text: requestText,
      request_kind: requestKind,
      history,
    }),
  });
  if (!response.ok) {
    let detail = "Failed to process help request";
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
  return (await response.json()) as TopicConversationHelpResponse;
}

export async function fetchTopicConversationUserLiteralTranslation(
  userText: string,
  sourceLanguage: StudyLanguageCode = "spanish",
  targetLanguage: StudyLanguageCode = "german",
): Promise<{ user_translation_text: string }> {
  const params = new URLSearchParams({
    source_language: sourceLanguage,
    target_language: targetLanguage,
  });
  const response = await apiFetch(`${API_BASE}/content/conversation/user-translation?${params.toString()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_text: userText }),
  });
  if (!response.ok) {
    throw new Error("Failed to translate user message");
  }
  return (await response.json()) as { user_translation_text: string };
}

export async function fetchTopicConversationUserCorrection(
  topic: string,
  notes: string,
  roleText: string,
  goalText: string,
  userText: string,
  history: Array<{ user_text: string; assistant_text: string }>,
  sourceLanguage: StudyLanguageCode = "spanish",
  targetLanguage: StudyLanguageCode = "german",
): Promise<{
  user_corrected_text: string;
  user_corrected_translation_text: string;
  user_correction_explanation: string;
}> {
  const params = new URLSearchParams({
    source_language: sourceLanguage,
    target_language: targetLanguage,
  });
  const response = await apiFetch(`${API_BASE}/content/conversation/user-correction?${params.toString()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      topic,
      notes,
      role_text: roleText,
      goal_text: goalText,
      user_text: userText,
      history,
    }),
  });
  if (!response.ok) {
    throw new Error("Failed to generate correction");
  }
  return (await response.json()) as {
    user_corrected_text: string;
    user_corrected_translation_text: string;
    user_correction_explanation: string;
  };
}

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
): Promise<{ created: boolean; exists: boolean; id?: number | null; source_text?: string; target_text?: string; word_type?: string; notes?: string; audio_url?: string }> {
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
      notes: "Added from dialog click",
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
  return (await response.json()) as {
    created: boolean;
    exists: boolean;
    id?: number | null;
    source_text?: string;
    target_text?: string;
    word_type?: string;
    audio_url?: string;
  };
}

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
      notes: "Added from conversation",
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

export async function deleteContentTopic(
  topic: string,
  sourceLanguage: StudyLanguageCode = "spanish",
  targetLanguage: StudyLanguageCode = "german",
): Promise<void> {
  const response = await apiFetch(`${API_BASE}/content/topics/delete`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      topic,
      source_language: sourceLanguage,
      target_language: targetLanguage,
    }),
  });
  if (!response.ok) {
    throw new Error("Failed to delete topic");
  }
}

export async function fetchOverviewStats(
  sourceLanguage: StudyLanguageCode = "spanish",
  targetLanguage: StudyLanguageCode = "german",
): Promise<OverviewStatsResponse> {
  const params = new URLSearchParams({
    source_language: sourceLanguage,
    target_language: targetLanguage,
  });
  const response = await apiFetch(`${API_BASE}/overview-stats?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to load overview stats");
  }
  return (await response.json()) as OverviewStatsResponse;
}
