import type { StudyLanguageCode } from "./types";

export const SUPPORTED_STUDY_LANGUAGES: StudyLanguageCode[] = [
  "spanish",
  "english",
  "german",
  "french",
  "italian",
  "portuguese",
  "dutch",
];

export const STUDY_LANGUAGE_MESSAGE_KEY_BY_CODE: Record<StudyLanguageCode, string> = {
  spanish: "study.language.spanish",
  english: "study.language.english",
  german: "study.language.german",
  french: "study.language.french",
  italian: "study.language.italian",
  portuguese: "study.language.portuguese",
  dutch: "study.language.dutch",
};

export const STUDY_LANGUAGE_SPEECH_LOCALE_BY_CODE: Record<StudyLanguageCode, string> = {
  spanish: "es-ES",
  english: "en-US",
  german: "de-DE",
  french: "fr-FR",
  italian: "it-IT",
  portuguese: "pt-PT",
  dutch: "nl-NL",
};

export const BROWSER_VOICE_PREVIEW_TEXT_BY_CODE: Record<StudyLanguageCode, string> = {
  spanish: "Hola. Esta es una prueba de voz.",
  english: "Hello. This is a voice preview.",
  german: "Hallo. Das ist eine Stimmprobe.",
  french: "Bonjour. Ceci est un apercu de la voix.",
  italian: "Ciao. Questa e una prova della voce.",
  portuguese: "Ola. Esta e uma demonstracao de voz.",
  dutch: "Hallo. Dit is een stemvoorbeeld.",
};
