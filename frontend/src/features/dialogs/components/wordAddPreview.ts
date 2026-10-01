import { matchWordFormationPatterns } from "../../../languageFeatures/wordFormation";
import { fetchWordFormationProgress } from "../../../apiWordFormation";

export type ConstructionPatternPreview = {
  key: string;
  form: string;
  meaning: string;
  explanation: string;
  example: string;
  matched_parts: string[];
  replaces_word: boolean;
  save_token?: string;
  saved_id?: number | null;
};

export type WordAddPreview = {
  target: string;
  source: string;
  wordType: string;
  construction?: ConstructionPatternPreview | null;
  wordSaved?: boolean;
};

export type DialogWordResult = {
  created: boolean;
  exists: boolean;
  id?: number | null;
  item_type?: "word" | "pattern";
  source_text?: string;
  target_text?: string;
  word_type?: string;
  notes?: string;
  audio_url?: string;
  construction_pattern?: ConstructionPatternPreview | null;
};

export async function shouldOpenSavedWord(result: DialogWordResult, sourceLanguage: string, targetLanguage: string): Promise<boolean> {
  if (!result.exists || (result.construction_pattern && !result.construction_pattern.saved_id)) return false;
  const matches = matchWordFormationPatterns(result.target_text || "", result.word_type || "", targetLanguage);
  if (!matches.length) return true;
  const progress = await fetchWordFormationProgress(sourceLanguage, targetLanguage);
  return !progress.supported || matches.every(({ pattern }) => progress.saved.includes(pattern.id));
}

export function wordAddPreview(result: DialogWordResult): WordAddPreview {
  const construction = result.construction_pattern;
  if (construction?.replaces_word) {
    return { source: construction.meaning, target: construction.form, wordType: "", construction };
  }
  if (!result.word_type?.trim() || !result.source_text?.trim() || !result.target_text?.trim()) {
    throw new Error("Incomplete word preview");
  }
  return { source: result.source_text, target: result.target_text, wordType: result.word_type, construction, wordSaved: result.exists };
}
