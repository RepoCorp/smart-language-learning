import type { ExercisePhrase, SessionItem } from "../../types";

type Candidate = { target: string; source: string; audioUrl: string };

export type CompletionPhrase = { text: string; sourceText: string; audioUrl: string };

function normalizedText(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
}

function containsExactTarget(phrase: string, target: string): boolean {
  const text = normalizedText(phrase);
  const word = normalizedText(target);
  if (!word || text === word) return false;
  const escaped = word.replace(/[.*+?^{}$()|[\]\\]/g, "\\$&");
  return new RegExp("(^|[^\\p{L}\\p{M}\\p{N}])" + escaped + "(?=$|[^\\p{L}\\p{M}\\p{N}])", "u").test(text);
}

function withAudioFirst(candidates: Candidate[]): Candidate[] {
  return [...candidates.filter(candidate => candidate.audioUrl), ...candidates.filter(candidate => !candidate.audioUrl)];
}

function fromCandidate(candidate: Candidate): CompletionPhrase {
  return { text: candidate.target, sourceText: candidate.source, audioUrl: candidate.audioUrl };
}

function strategyCandidates(item: SessionItem): Candidate[] {
  const phrases = item.exercise_phrases;
  if (!phrases) return [];
  const entries: Array<ExercisePhrase | undefined> = [
    ...(phrases.phrases || []), ...(phrases.first_section || []), ...(phrases.second_section || []),
    ...(phrases.sections || []).flatMap(section => section.phrases),
    ...(phrases.personalize_phrases || []), ...(phrases.practice_phrases || []),
    phrases.funny_image_phrase, phrases.visualize_phrase, phrases.act_exercise, phrases.walk_challenge,
    ...(phrases.encounter_situations || []),
    ...(phrases.compare_strategy || []).map(entry => ({
      target_text: entry.target_example_text, source_text: entry.target_translation_text,
    })),
  ];
  return entries.filter((entry): entry is ExercisePhrase => Boolean(entry)).map(entry => ({
    target: entry.target_text, source: entry.source_text, audioUrl: entry.audio_url || "",
  }));
}

export function completionPhraseForItem(item: SessionItem): CompletionPhrase {
  const dialogs = item.related_dialogs || [];
  const dialogCandidates = dialogs.flatMap(dialog => dialog.turns.map(turn => ({
    target: turn.target_text, source: turn.source_text, audioUrl: turn.phrase_audio_url || "",
  })));
  const matchedCandidates = dialogs.flatMap(dialog => dialog.matched_turns.map(turn => {
    const related = dialog.turns[turn.turn_index];
    const samePhrase = related && normalizedText(related.target_text) === normalizedText(turn.target_text);
    return {
      target: turn.target_text, source: turn.source_text || (samePhrase ? related.source_text : ""),
      audioUrl: samePhrase ? related.phrase_audio_url || "" : "",
    };
  }));
  const candidates = [matchedCandidates, dialogCandidates, strategyCandidates(item)].flatMap(withAudioFirst);
  const original = item.example_sentence?.trim() || "";
  const originalCandidate = withAudioFirst(candidates).find(candidate =>
    original && normalizedText(candidate.target) === normalizedText(original));

  if (item.word_type?.trim().toLowerCase() !== "expression") {
    const exact = candidates.find(candidate => candidate.source.trim() && containsExactTarget(candidate.target, item.german_text));
    if (exact) return fromCandidate(exact);
  }

  if (originalCandidate) return { ...fromCandidate(originalCandidate), text: original };
  return { text: original, sourceText: "", audioUrl: "" };
}

export function completionReplayAudio(itemAudioUrl: string | undefined, phrase: CompletionPhrase): string {
  return phrase.text ? phrase.audioUrl : itemAudioUrl || "";
}
