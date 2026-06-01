export type ItemType = "word" | "phrase";
export type SessionMode = "new" | "review";
export type ReviewDirection = "es_to_de" | "de_to_es";
export type StudyLanguageCode = "spanish" | "english" | "german" | "french" | "italian" | "portuguese";

export interface ExercisePhrase {
  label?: string;
  source_text: string;
  target_text: string;
  image_url?: string;
  image_prompt?: string;
}

export interface ItemExercisePhrases {
  phrases?: ExercisePhrase[];
  first_section?: ExercisePhrase[];
  second_section?: ExercisePhrase[];
  generation_mode?: string;
  funny_image_phrase?: ExercisePhrase;
}

export interface SessionItem {
  id: number;
  item_type: ItemType;
  spanish_text: string;
  german_text: string;
  example_sentence?: string;
  notes?: string;
  word_type?: string;
  audio_url?: string;
  exercise_phrases?: ItemExercisePhrases;
  mode: SessionMode;
  direction?: ReviewDirection | null;
  repeatedAfterFailure?: boolean;
  repeatPracticeStep?: "word_intro" | "word_cloze" | "phrase_builder" | "phrase_dialog_match";
  options: string[];
  option_items?: Array<{
    id: number;
    text: string;
  }>;
  dialog_phrase_answer?: string;
  dialog_phrase_scene?: string;
  dialog_phrase_scene_audio_urls?: string[];
  dialog_phrase_options?: string[];
  related_dialogs?: Array<{
    dialog_id: number;
    topic: string;
    context: string;
    audio_url: string;
    created_at: string;
    turns: Array<{
      source_text: string;
      target_text: string;
      speaker?: "a" | "b";
      phrase_audio_url?: string;
    }>;
    matched_turns: Array<{
      turn_index: number;
      side: "source" | "target";
      match_score: number;
      source_text: string;
      target_text: string;
    }>;
  }>;
  item_questions?: ItemQuestionExchange[];
}

export type ItemQuestionType = "grammar_explanation" | "more_examples" | "common_mistakes" | "custom_related";

export interface ItemQuestionExchange {
  id: number;
  question_type: ItemQuestionType;
  question_text: string;
  answer_text: string;
  created_at: string;
}

export interface SessionResponse {
  items: SessionItem[];
}

export interface ContentCandidate {
  spanish_text: string;
  german_text: string;
  exists: boolean;
  notes?: string;
  word_type?: string;
  selection_key?: string;
}

export interface ContentPreviewResponse {
  topic: string;
  context?: string;
  source_language?: StudyLanguageCode;
  target_language?: StudyLanguageCode;
  dialog_turns: Array<{ source_text: string; target_text: string; speaker?: "a" | "b" }>;
}

export interface ContentConfirmResponse {
  topic: string;
  source_language?: StudyLanguageCode;
  target_language?: StudyLanguageCode;
  saved_dialog_id?: number;
  saved_dialog_turns?: Array<{ source_text: string; target_text: string; speaker?: "a" | "b" }>;
  dialog_audio_url?: string;
  created_sentence_count?: number;
  existing_sentence_count?: number;
}

export interface ContentTopicsResponse {
  topics: string[];
}

export interface ContentDialogRecord {
  dialog_id: number;
  topic: string;
  context: string;
  audio_url: string;
  created_at: string;
  turns: Array<{
    source_text: string;
    target_text: string;
    speaker?: "a" | "b";
    phrase_audio_url?: string;
  }>;
}

export interface ContentDialogsResponse {
  dialogs: ContentDialogRecord[];
}

export interface ContentItemRecord {
  id: number;
  item_type: ItemType;
  spanish_text: string;
  german_text: string;
  created_at: string;
  next_review_days?: number | null;
  audio_url?: string;
  word_type?: string;
  is_learned?: boolean;
}

export interface ContentItemsResponse {
  items: ContentItemRecord[];
}

export interface ContentItemDetailResponse {
  id: number;
  item_type: ItemType;
  spanish_text: string;
  german_text: string;
  example_sentence?: string;
  notes?: string;
  word_type?: string;
  audio_url?: string;
  created_at: string;
  exercise_phrases?: ItemExercisePhrases;
  dialog_phrase_answer?: string;
  dialog_phrase_scene?: string;
  dialog_phrase_scene_audio_urls?: string[];
  dialog_phrase_options?: string[];
  related_dialogs?: SessionItem["related_dialogs"];
  item_questions?: ItemQuestionExchange[];
}

export interface ContentItemQuestionResponse {
  exchange: ItemQuestionExchange;
  conversation: ItemQuestionExchange[];
}

export interface ContentItemRefreshWordResponse {
  ok: boolean;
  spanish_text?: string;
  german_text?: string;
  word_type?: string;
  word_type_added?: boolean;
  word_text_updated?: boolean;
  exercise_phrases?: ItemExercisePhrases;
  dialog_occurrences_created?: number;
  related_dialogs?: SessionItem["related_dialogs"];
}

export interface ContentItemConversationResponse {
  user_text: string;
  user_translation_text?: string;
  user_corrected_text?: string;
  user_corrected_translation_text?: string;
  user_correction_explanation?: string;
  user_is_grammatically_correct?: boolean;
  user_makes_sense_in_context?: boolean;
  user_needs_correction?: boolean;
  assistant_text: string;
  assistant_translation_text?: string;
  assistant_audio_url?: string;
  goal_achieved?: boolean;
  goal_achievement_message?: string;
  next_goal_suggestion?: string;
}

export interface ContentTopicContextsResponse {
  contexts: string[];
}

export interface TopicConversationStartResponse {
  topic: string;
  notes?: string;
  role_text?: string;
  goal_difficulty?: "easy" | "medium" | "hard";
  goal_text: string;
  opening_text?: string;
  opening_translation_text?: string;
  opening_audio_url?: string;
}

export interface TopicConversationHelpResponse {
  request_kind?: "coach" | "say";
  request_text: string;
  help_text: string;
  target_text?: string;
}

export interface OverviewStatsResponse {
  ready_to_review: number;
  future_reviews: number;
  word_items: number;
  not_started: number;
}
