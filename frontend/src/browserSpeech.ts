function languagePrefix(lang: string): string {
  return lang.split("-")[0]?.toLowerCase() || "";
}

function languageRegion(lang: string): string {
  return lang.split("-")[1]?.toLowerCase() || "";
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
  "festival",
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

const LANGUAGE_PREFERRED_KEYWORDS: Record<string, string[]> = {
  fr: [
    "france",
    "français",
    "francais",
    "thomas",
    "amelie",
    "amélie",
    "audrey",
    "google français",
    "google francais",
  ],
};

const LANGUAGE_AVOID_KEYWORDS: Record<string, string[]> = {
  fr: [
    "canada",
    "canadien",
    "canadian",
    "québec",
    "quebec",
  ],
};

function voiceText(voice: SpeechSynthesisVoice): string {
  return `${voice.name} ${voice.voiceURI}`.toLowerCase();
}

function scoreVoice(
  voice: SpeechSynthesisVoice,
  lang: string,
  preferredVoiceURI = "",
): number {
  const prefix = languagePrefix(lang);
  const region = languageRegion(lang);
  const voiceRegion = languageRegion(voice.lang);
  const voiceLang = voice.lang.toLowerCase();
  const text = voiceText(voice);
  let score = 0;

  if (preferredVoiceURI && voice.voiceURI === preferredVoiceURI) {
    score += 500;
  }
  if (voiceLang === lang.toLowerCase()) {
    score += 260;
  } else if (voiceLang.startsWith(prefix)) {
    score += 120;
  }
  if (region && voiceRegion) {
    if (voiceRegion === region) {
      score += 70;
    } else if (prefix === "fr") {
      score -= 35;
    }
  }
  if (voice.default) {
    score += 20;
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
  if ((LANGUAGE_PREFERRED_KEYWORDS[prefix] || []).some((keyword) => text.includes(keyword))) {
    score += 55;
  }
  if ((LANGUAGE_AVOID_KEYWORDS[prefix] || []).some((keyword) => text.includes(keyword))) {
    score -= 45;
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
