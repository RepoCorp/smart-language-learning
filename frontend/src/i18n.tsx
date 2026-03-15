import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type AppLanguage = "en" | "es";

const STORAGE_KEY = "app_language";

const messages = {
  en: {
    "lang.english": "English",
    "lang.spanish": "Spanish",
    "lang.label": "App language",
    "study.label": "Study pair",
    "study.source": "From",
    "study.target": "To",
    "study.language.spanish": "Spanish",
    "study.language.english": "English",
    "study.language.german": "German",
    "study.language.french": "French",
    "study.language.italian": "Italian",
    "study.language.portuguese": "Portuguese",
    "stats.ready": "Ready to review: {count}",
    "stats.future": "Future reviews: {count}",
    "stats.notStarted": "Not started: {count}",
    "session.loading": "Loading session...",
    "session.loadFailed": "Failed to load session",
    "session.error": "Error: {message}",
    "session.empty": "No content available.",
    "session.title": "Learning session",
    "session.createContent": "Create content",
    "session.itemProgress": "Item {current} of {total}",
    "session.movingNext": "Moving to the next item...",
    "content.title": "Create content",
    "content.description": "Enter a topic and the app will generate a short simple conversation and candidate vocabulary.",
    "content.backToSession": "Back to session",
    "content.manageLink": "Manage saved content",
    "content.topic.section": "Topic",
    "content.topic.label": "Topic",
    "content.topic.select": "Select a topic...",
    "content.topic.none": "No saved topics yet",
    "content.topic.createNew": "Create new topic...",
    "content.topic.newLabel": "New topic",
    "content.topic.placeholder": "e.g. travel, cooking, machine learning",
    "content.context.section": "Context",
    "content.context.label": "Context",
    "content.context.none": "No context",
    "content.context.createNew": "Create new context...",
    "content.context.placeholder": "e.g. in a restaurant, at the airport, formal tone",
    "content.generate": "Generate preview",
    "content.generating": "Generating...",
    "content.preview.title": "Preview",
    "content.preview.phrases": "Conversation phrases:",
    "content.preview.unselectAllPhrases": "Unselect all phrases",
    "content.preview.selectAllPhrases": "Select all phrases",
    "content.preview.personA": "Person A",
    "content.preview.personB": "Person B",
    "content.preview.exists": "already exists",
    "content.preview.new": "new",
    "content.preview.newItems": "New items to save:",
    "content.preview.words": "Candidate words:",
    "content.preview.unselectAllWords": "Unselect all words",
    "content.preview.selectAllWords": "Select all words",
    "content.save": "Confirm and save",
    "content.saving": "Saving...",
    "content.cancel": "Cancel",
    "manage.title": "Manage saved content",
    "manage.backToSession": "Back to session",
    "manage.backToCreate": "Back to create",
    "manage.topics": "Saved topics",
    "manage.items": "Saved items",
    "manage.words": "Saved words",
    "manage.phrases": "Saved phrases",
    "manage.emptyTopics": "No topics for this language pair.",
    "manage.emptyItems": "No items for this language pair.",
    "manage.emptyWords": "No words for this language pair.",
    "manage.emptyPhrases": "No phrases for this language pair.",
    "manage.deleteTopic": "Delete topic",
    "manage.deleteItem": "Delete item",
    "manage.deleteSelectedTopics": "Delete selected topics",
    "manage.deleteSelectedItems": "Delete selected items",
    "manage.selectAll": "Select all",
    "manage.unselectAll": "Unselect all",
    "manage.deleting": "Deleting...",
    "manage.error.load": "Failed to load saved content",
    "manage.error.deleteTopic": "Failed to delete topic",
    "manage.error.deleteItem": "Failed to delete item",
    "content.error.selectOrEnterTopic": "Please select or enter a topic.",
    "content.error.enterTopic": "Please enter a topic.",
    "content.error.generatePreview": "Failed to generate preview",
    "content.error.saveContent": "Failed to save content",
    "content.result.phrasesCreated": "{count} phrase(s) created",
    "content.result.phrasesExisted": "all phrases already existed",
    "content.result.savedNoWords": "Saved: no new words selected, {phraseMessage}.",
    "content.result.savedWithWords": "Saved: {count} word(s), {phraseMessage}.",
    "newItem.word": "New word",
    "newItem.phrase": "New phrase",
    "newItem.sourceLabel": "{language}:",
    "newItem.targetLabel": "{language}:",
    "newItem.example": "Example:",
    "newItem.notes": "Notes:",
    "newItem.noAudioSupport": "Your browser does not support audio.",
    "newItem.audioLink": "Audio link",
    "newItem.gotIt": "Got it",
    "newItem.saving": "Saving...",
    "phrase.prompt": "Select the correct {language} translation: {text}",
    "phrase.feedback.correct": "Correct",
    "phrase.feedback.incorrect": "Incorrect. Answer: {answer}",
    "phrase.feedback.markedWrong": "Marked as incorrect by choice. Answer: {answer}",
    "phrase.markFailed": "I recognized it but mark failed",
    "word.prompt": "Write in {language}: {text}",
    "word.feedback.empty": "Please enter an answer.",
    "word.feedback.correct": "Correct",
    "word.feedback.tooManyHints": "Correct answer entered, but too many hints were used. It will be treated as incorrect: {answer}",
    "word.feedback.incorrect": "Incorrect. Answer: {answer}",
    "word.input.placeholder": "Your answer",
    "word.hint": "Hint: {letter}",
    "word.hintButton": "Hint",
    "word.checkButton": "Check",
    "word.acceptButton": "Accept",
  },
  es: {
    "lang.english": "Inglés",
    "lang.spanish": "Español",
    "lang.label": "Idioma de la app",
    "study.label": "Par de estudio",
    "study.source": "De",
    "study.target": "A",
    "study.language.spanish": "Español",
    "study.language.english": "Inglés",
    "study.language.german": "Alemán",
    "study.language.french": "Francés",
    "study.language.italian": "Italiano",
    "study.language.portuguese": "Portugués",
    "stats.ready": "Listo para repasar: {count}",
    "stats.future": "Repasos futuros: {count}",
    "stats.notStarted": "Sin empezar: {count}",
    "session.loading": "Cargando sesión...",
    "session.loadFailed": "No se pudo cargar la sesión",
    "session.error": "Error: {message}",
    "session.empty": "No hay contenido disponible.",
    "session.title": "Sesión de aprendizaje",
    "session.createContent": "Crear contenido",
    "session.itemProgress": "Elemento {current} de {total}",
    "session.movingNext": "Pasando al siguiente elemento...",
    "content.title": "Crear contenido",
    "content.description": "Ingresa un tema y la app generará una conversación corta y simple con vocabulario candidato.",
    "content.backToSession": "Volver a la sesión",
    "content.manageLink": "Gestionar contenido guardado",
    "content.topic.section": "Tema",
    "content.topic.label": "Tema",
    "content.topic.select": "Selecciona un tema...",
    "content.topic.none": "Aún no hay temas guardados",
    "content.topic.createNew": "Crear tema nuevo...",
    "content.topic.newLabel": "Tema nuevo",
    "content.topic.placeholder": "p. ej. viajes, cocina, aprendizaje automático",
    "content.context.section": "Contexto",
    "content.context.label": "Contexto",
    "content.context.none": "Sin contexto",
    "content.context.createNew": "Crear contexto nuevo...",
    "content.context.placeholder": "p. ej. en un restaurante, en el aeropuerto, tono formal",
    "content.generate": "Generar vista previa",
    "content.generating": "Generando...",
    "content.preview.title": "Vista previa",
    "content.preview.phrases": "Frases de la conversación:",
    "content.preview.unselectAllPhrases": "Deseleccionar todas las frases",
    "content.preview.selectAllPhrases": "Seleccionar todas las frases",
    "content.preview.personA": "Persona A",
    "content.preview.personB": "Persona B",
    "content.preview.exists": "ya existe",
    "content.preview.new": "nuevo",
    "content.preview.newItems": "Nuevos elementos a guardar:",
    "content.preview.words": "Palabras candidatas:",
    "content.preview.unselectAllWords": "Deseleccionar todas las palabras",
    "content.preview.selectAllWords": "Seleccionar todas las palabras",
    "content.save": "Confirmar y guardar",
    "content.saving": "Guardando...",
    "content.cancel": "Cancelar",
    "manage.title": "Gestionar contenido guardado",
    "manage.backToSession": "Volver a la sesión",
    "manage.backToCreate": "Volver a crear",
    "manage.topics": "Temas guardados",
    "manage.items": "Elementos guardados",
    "manage.words": "Palabras guardadas",
    "manage.phrases": "Frases guardadas",
    "manage.emptyTopics": "No hay temas para este par de idiomas.",
    "manage.emptyItems": "No hay elementos para este par de idiomas.",
    "manage.emptyWords": "No hay palabras para este par de idiomas.",
    "manage.emptyPhrases": "No hay frases para este par de idiomas.",
    "manage.deleteTopic": "Eliminar tema",
    "manage.deleteItem": "Eliminar elemento",
    "manage.deleteSelectedTopics": "Eliminar temas seleccionados",
    "manage.deleteSelectedItems": "Eliminar elementos seleccionados",
    "manage.selectAll": "Seleccionar todo",
    "manage.unselectAll": "Deseleccionar todo",
    "manage.deleting": "Eliminando...",
    "manage.error.load": "No se pudo cargar el contenido guardado",
    "manage.error.deleteTopic": "No se pudo eliminar el tema",
    "manage.error.deleteItem": "No se pudo eliminar el elemento",
    "content.error.selectOrEnterTopic": "Selecciona o ingresa un tema.",
    "content.error.enterTopic": "Ingresa un tema.",
    "content.error.generatePreview": "No se pudo generar la vista previa",
    "content.error.saveContent": "No se pudo guardar el contenido",
    "content.result.phrasesCreated": "{count} frase(s) creada(s)",
    "content.result.phrasesExisted": "todas las frases ya existían",
    "content.result.savedNoWords": "Guardado: no se seleccionaron palabras nuevas, {phraseMessage}.",
    "content.result.savedWithWords": "Guardado: {count} palabra(s), {phraseMessage}.",
    "newItem.word": "Palabra nueva",
    "newItem.phrase": "Frase nueva",
    "newItem.sourceLabel": "{language}:",
    "newItem.targetLabel": "{language}:",
    "newItem.example": "Ejemplo:",
    "newItem.notes": "Notas:",
    "newItem.noAudioSupport": "Tu navegador no soporta audio.",
    "newItem.audioLink": "Enlace de audio",
    "newItem.gotIt": "Entendido",
    "newItem.saving": "Guardando...",
    "phrase.prompt": "Selecciona la traducción correcta en {language}: {text}",
    "phrase.feedback.correct": "Correcto",
    "phrase.feedback.incorrect": "Incorrecto. Respuesta: {answer}",
    "phrase.feedback.markedWrong": "Marcado como incorrecto por elección. Respuesta: {answer}",
    "phrase.markFailed": "La reconocí, pero marcar como fallida",
    "word.prompt": "Escribe en {language}: {text}",
    "word.feedback.empty": "Ingresa una respuesta.",
    "word.feedback.correct": "Correcto",
    "word.feedback.tooManyHints": "Ingresaste la respuesta correcta, pero usaste demasiadas pistas. Se tomará como incorrecta: {answer}",
    "word.feedback.incorrect": "Incorrecto. Respuesta: {answer}",
    "word.input.placeholder": "Tu respuesta",
    "word.hint": "Pista: {letter}",
    "word.hintButton": "Pista",
    "word.checkButton": "Comprobar",
    "word.acceptButton": "Aceptar",
  },
} as const;

type MessageKey = keyof typeof messages.en;

interface I18nContextValue {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
}

function formatMessage(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    return Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : `{${name}}`;
  });
}

function getInitialLanguage(): AppLanguage {
  if (typeof window === "undefined") {
    return "en";
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "es" ? "es" : "en";
}

const defaultContext: I18nContextValue = {
  language: "en",
  setLanguage: () => {},
  t: (key, vars) => formatMessage(messages.en[key], vars),
};

const I18nContext = createContext<I18nContextValue>(defaultContext);

export function I18nProvider({ children }: { children: ReactNode }): JSX.Element {
  const [language, setLanguageState] = useState<AppLanguage>(getInitialLanguage);

  const setLanguage = (value: AppLanguage): void => {
    setLanguageState(value);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, value);
    }
  };

  const value = useMemo<I18nContextValue>(() => {
    return {
      language,
      setLanguage,
      t: (key, vars) => formatMessage(messages[language][key], vars),
    };
  }, [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
