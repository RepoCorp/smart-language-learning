export type ItemType = "word" | "phrase";
export type SessionMode = "new" | "review";
export type ReviewDirection = "es_to_de" | "de_to_es";

export interface SessionItem {
  id: number;
  item_type: ItemType;
  spanish_text: string;
  german_text: string;
  example_sentence?: string;
  notes?: string;
  audio_url?: string;
  mode: SessionMode;
  direction?: ReviewDirection | null;
  options: string[];
}

export interface SessionResponse {
  items: SessionItem[];
}

export interface ContentCandidate {
  spanish_text: string;
  german_text: string;
  exists: boolean;
  notes?: string;
  selection_key?: string;
}

export interface ContentPreviewResponse {
  topic: string;
  context?: string;
  phrases: ContentCandidate[];
  words: ContentCandidate[];
  new_items_count: number;
}

export interface ContentConfirmResponse {
  topic: string;
  created_phrase: boolean;
  created_phrases_count?: number;
  created_words_count: number;
  created_words: string[];
}

export interface ContentTopicsResponse {
  topics: string[];
}

export interface ContentTopicContextsResponse {
  contexts: string[];
}

export interface OverviewStatsResponse {
  ready_to_review: number;
  future_reviews: number;
  not_started: number;
}
