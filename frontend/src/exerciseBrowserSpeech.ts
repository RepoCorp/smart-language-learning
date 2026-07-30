import { selectBestSpeechSynthesisVoice } from "./browserSpeech";
import { STUDY_LANGUAGE_SPEECH_LOCALE_BY_CODE } from "./studyLanguageMetadata";

const BROWSER_EXERCISE_SPEECH_RATE = 0.72;
const BROWSER_EXERCISE_WORD_RATE = 0.82;
export const BROWSER_EXERCISE_PHRASE_PAUSE_MS = 480;

function browserSpeechAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

function getSpeechLanguage(targetLanguage: string): string {
  return STUDY_LANGUAGE_SPEECH_LOCALE_BY_CODE[targetLanguage] || "de-DE";
}

export function playBrowserExerciseWord(
  targetText: string,
  targetLanguage: string,
  preferredBrowserVoiceURI: string,
): void {
  if (!browserSpeechAvailable() || !targetText.trim()) {
    return;
  }

  const speechSynthesis = window.speechSynthesis;
  const lang = getSpeechLanguage(targetLanguage);
  const langPrefix = lang.split("-")[0]?.toLowerCase() || "";
  speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(targetText);
  utterance.lang = lang;
  utterance.rate = BROWSER_EXERCISE_WORD_RATE;

  const matchingVoices = speechSynthesis
    .getVoices()
    .filter((voice) => voice.lang.toLowerCase().startsWith(langPrefix));
  const selectedVoice = selectBestSpeechSynthesisVoice(matchingVoices, lang, preferredBrowserVoiceURI);
  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }
  speechSynthesis.speak(utterance);
}

export async function pauseBrowserExercisePhrases(
  _runId: number,
  isRunning: () => boolean,
): Promise<void> {
  if (!isRunning()) {
    return;
  }
  await new Promise<void>((resolve) => window.setTimeout(resolve, BROWSER_EXERCISE_PHRASE_PAUSE_MS));
}

export async function speakBrowserExerciseLinesOnce({
  lines,
  runId,
  isRunning,
  isMuted,
  targetLanguage,
  preferredBrowserVoiceURI,
}: {
  lines: string[];
  runId: number;
  isRunning: () => boolean;
  isMuted: () => boolean;
  targetLanguage: string;
  preferredBrowserVoiceURI: string;
}): Promise<void> {
  if (!browserSpeechAvailable()) {
    return;
  }

  const speechSynthesis = window.speechSynthesis;
  speechSynthesis.cancel();
  if (!isRunning()) {
    return;
  }
  if (isMuted()) {
    await new Promise<void>((resolve) => window.setTimeout(resolve, BROWSER_EXERCISE_PHRASE_PAUSE_MS));
    return;
  }

  const preparedLines = lines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/[.?!]\s*$/u, ""));
  if (preparedLines.length === 0) {
    return;
  }

  const lang = getSpeechLanguage(targetLanguage);
  const selectedVoice = selectBestSpeechSynthesisVoice(speechSynthesis.getVoices(), lang, preferredBrowserVoiceURI);

  for (let index = 0; index < preparedLines.length; index += 1) {
    if (!isRunning()) {
      return;
    }
    if (isMuted()) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, BROWSER_EXERCISE_PHRASE_PAUSE_MS));
      return;
    }

    const line = preparedLines[index];
    await new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(line);
      let settled = false;
      let muteCheck: number | null = null;
      const finish = (): void => {
        if (settled) {
          return;
        }
        settled = true;
        if (muteCheck !== null) {
          window.clearInterval(muteCheck);
        }
        resolve();
      };

      muteCheck = window.setInterval(() => {
        if (!isRunning() || isMuted()) {
          speechSynthesis.cancel();
          finish();
        }
      }, 50);

      utterance.lang = lang;
      utterance.rate = BROWSER_EXERCISE_SPEECH_RATE;
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
      utterance.onend = finish;
      utterance.onerror = finish;
      speechSynthesis.speak(utterance);
    });

    if (index < preparedLines.length - 1) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, BROWSER_EXERCISE_PHRASE_PAUSE_MS));
    }
  }
}
