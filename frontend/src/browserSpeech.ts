function languagePrefix(lang: string): string {
  return lang.split("-")[0]?.toLowerCase() || "";
}

const HIGH_QUALITY_KEYWORDS = [
  "natural",
  "neural",
  "premium",
  "enhanced",
  "google",
  "microsoft",
  "siri",
];

const LOW_QUALITY_KEYWORDS = [
  "compact",
  "eloquence",
];

const NOVELTY_VOICE_KEYWORDS = [
  "zarvox",
  "trinoids",
  "whisper",
  "bells",
  "boing",
  "bubbles",
  "bad news",
  "good news",
  "organ",
  "cellos",
  "wobble",
  "jester",
  "superstar",
  "princess",
  "junior",
  "deranged",
  "hysterical",
];

function voiceText(voice: SpeechSynthesisVoice): string {
  return `${voice.name} ${voice.voiceURI}`.toLowerCase();
}

function scoreVoice(
  voice: SpeechSynthesisVoice,
  lang: string,
  preferredVoiceURI = "",
): number {
  const prefix = languagePrefix(lang);
  const voiceLang = voice.lang.toLowerCase();
  const text = voiceText(voice);
  let score = 0;

  if (preferredVoiceURI && voice.voiceURI === preferredVoiceURI) {
    score += 500;
  }
  if (voiceLang === lang.toLowerCase()) {
    score += 220;
  } else if (voiceLang.startsWith(prefix)) {
    score += 140;
  }
  if (voice.default) {
    score += 80;
  }
  if (voice.localService) {
    score += 35;
  }
  if (HIGH_QUALITY_KEYWORDS.some((keyword) => text.includes(keyword))) {
    score += 60;
  }
  if (LOW_QUALITY_KEYWORDS.some((keyword) => text.includes(keyword))) {
    score -= 25;
  }
  if (NOVELTY_VOICE_KEYWORDS.some((keyword) => text.includes(keyword))) {
    score -= 300;
  }

  return score;
}

export function selectBestSpeechSynthesisVoice(
  voices: SpeechSynthesisVoice[],
  lang: string,
  preferredVoiceURI = "",
): SpeechSynthesisVoice | undefined {
  const prefix = languagePrefix(lang);
  const matchingVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith(prefix));
  const candidates = matchingVoices.length > 0 ? matchingVoices : voices;
  return [...candidates].sort((left, right) => (
    scoreVoice(right, lang, preferredVoiceURI) - scoreVoice(left, lang, preferredVoiceURI)
  ))[0];
}
