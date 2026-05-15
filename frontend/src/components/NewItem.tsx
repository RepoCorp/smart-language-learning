import { Fragment, useEffect, useRef, useState } from "react";

import {
  askContentItemQuestion,
  fetchContentItemDetail,
  generateContentItemExercises,
  quickAddWordFromDialog,
} from "../api";
import { useI18n } from "../i18n";
import { usePromptPreferences } from "../promptPreferences";
import { type StudyLanguageCode, useStudyLanguages } from "../studyLanguages";
import type { SessionItem } from "../types";

interface NewItemProps {
  item: SessionItem;
  onContinue?: () => Promise<void>;
  readOnly?: boolean;
  onClose?: () => void;
}

const MAX_EXERCISE_ENTRIES = 30;
const VERB_BY_TENSE_GENERATION_MODE = "verb_by_tense_v1";
const VERB_TENSES = [
  { key: "present", label: "Present" },
  { key: "perfect", label: "Perfect" },
  { key: "simple-past", label: "Simple past" },
  { key: "future", label: "Future" },
] as const;
const VERB_PERSONS = [
  { key: "1s", label: "1s" },
  { key: "2s", label: "2s" },
  { key: "3s", label: "3s" },
  { key: "1p", label: "1p" },
  { key: "2p", label: "2p" },
  { key: "3p", label: "3p" },
] as const;
type VerbTenseKey = typeof VERB_TENSES[number]["key"];
type VerbPersonKey = typeof VERB_PERSONS[number]["key"];

const parseVerbExerciseLabel = (label: string): { tense: VerbTenseKey; person: VerbPersonKey } | null => {
  const normalized = label.trim().toLowerCase().replace(/_/g, "-").replace(/\s+/g, "-");
  const personAliases: Record<string, VerbPersonKey> = {
    "1s": "1s",
    "first-singular": "1s",
    "1st-singular": "1s",
    "2s": "2s",
    "second-singular": "2s",
    "2nd-singular": "2s",
    "3s": "3s",
    "third-singular": "3s",
    "3rd-singular": "3s",
    "1p": "1p",
    "first-plural": "1p",
    "1st-plural": "1p",
    "2p": "2p",
    "second-plural": "2p",
    "2nd-plural": "2p",
    "3p": "3p",
    "third-plural": "3p",
    "3rd-plural": "3p",
  };
  const match = normalized.match(/^(present|perfect|simple-past|future)-(.+)$/);
  if (!match) {
    return null;
  }
  const person = personAliases[match[2]];
  if (!person) {
    return null;
  }
  return { tense: match[1] as VerbTenseKey, person };
};

export default function NewItem({ item, onContinue, readOnly = false, onClose }: NewItemProps): JSX.Element {
  const { t } = useI18n();
  const { targetPromptMode } = usePromptPreferences();
  const { sourceLanguage, targetLanguage } = useStudyLanguages();
  const languageKeyByCode: Record<StudyLanguageCode, Parameters<typeof t>[0]> = {
    spanish: "study.language.spanish",
    english: "study.language.english",
    german: "study.language.german",
    french: "study.language.french",
    italian: "study.language.italian",
    portuguese: "study.language.portuguese",
  };
  const sourceLanguageLabel = t(languageKeyByCode[sourceLanguage]);
  const targetLanguageLabel = t(languageKeyByCode[targetLanguage]);
  const [saving, setSaving] = useState<boolean>(false);
  const [showAllDialogs, setShowAllDialogs] = useState<boolean>(false);
  const [showDialogsModal, setShowDialogsModal] = useState<boolean>(false);
  const [showExerciseModal, setShowExerciseModal] = useState<boolean>(false);
  const [loadingExercises, setLoadingExercises] = useState<boolean>(false);
  const [exerciseError, setExerciseError] = useState<string>("");
  const [showQuestionsModal, setShowQuestionsModal] = useState<boolean>(false);
  const [selectedExerciseKeys, setSelectedExerciseKeys] = useState<string[]>([]);
  const [exerciseSecondsLeft, setExerciseSecondsLeft] = useState<number>(30);
  const [exerciseRunning, setExerciseRunning] = useState<boolean>(false);
  const [wordActionStatus, setWordActionStatus] = useState<Record<string, "idle" | "saving" | "added" | "exists" | "error">>({});
  const [pendingWordAdd, setPendingWordAdd] = useState<{
    key: string;
    source: string;
    target: string;
    dialogId?: number;
    turnIndex?: number;
  } | null>(null);
  const [addingWord, setAddingWord] = useState<boolean>(false);
  const [openedLinkedWord, setOpenedLinkedWord] = useState<SessionItem | null>(null);
  const [loadingLinkedWord, setLoadingLinkedWord] = useState<boolean>(false);
  const [itemQuestions, setItemQuestions] = useState<NonNullable<SessionItem["item_questions"]>>(item.item_questions || []);
  const [exercisePhrases, setExercisePhrases] = useState(item.exercise_phrases || {});
  const [itemQuestionError, setItemQuestionError] = useState<string>("");
  const [itemQuestionInput, setItemQuestionInput] = useState<string>("");
  const [askingQuestion, setAskingQuestion] = useState<boolean>(false);
  const [showDialogTargetText, setShowDialogTargetText] = useState<boolean>(targetPromptMode === "text");
  const exerciseTimerRef = useRef<number | null>(null);
  const exerciseRunRef = useRef<number>(0);
  const exerciseRunningRef = useRef<boolean>(false);
  const exerciseAudioRef = useRef<HTMLAudioElement | null>(null);
  const questionsHistoryRef = useRef<HTMLDivElement | null>(null);
  const questionInputRef = useRef<HTMLInputElement | null>(null);
  const hideDialogTargetText = targetPromptMode === "audio" && !showDialogTargetText;

  useEffect(() => {
    setExercisePhrases(item.exercise_phrases || {});
    setExerciseError("");
  }, [item.id, item.exercise_phrases]);

  const markAsSeen = async (): Promise<void> => {
    if (saving || !onContinue) {
      return;
    }
    setSaving(true);
    try {
      await onContinue();
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (readOnly || !onContinue) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (showQuestionsModal || showDialogsModal || showExerciseModal) {
        return;
      }
      if (event.key !== "Enter") {
        return;
      }
      event.preventDefault();
      void markAsSeen();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [saving, onContinue, readOnly, showQuestionsModal, showDialogsModal, showExerciseModal]);

  useEffect(() => {
    if (!showDialogsModal) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      const firstMatch = document.querySelector(".related-dialogs-modal .turn-highlight");
      if (firstMatch instanceof HTMLElement) {
        firstMatch.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 30);
    return () => window.clearTimeout(timeoutId);
  }, [showDialogsModal, showAllDialogs, item.related_dialogs]);

  useEffect(() => {
    exerciseRunningRef.current = exerciseRunning;
  }, [exerciseRunning]);

  useEffect(() => () => {
    exerciseRunRef.current += 1;
    if (exerciseTimerRef.current !== null) {
      window.clearInterval(exerciseTimerRef.current);
      exerciseTimerRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (exerciseAudioRef.current) {
      exerciseAudioRef.current.pause();
      exerciseAudioRef.current.currentTime = 0;
      exerciseAudioRef.current = null;
    }
  }, []);

  useEffect(() => {
    setItemQuestions(item.item_questions || []);
    setItemQuestionError("");
    setItemQuestionInput("");
    setAskingQuestion(false);
    setShowQuestionsModal(false);
  }, [item.id, item.item_questions]);

  useEffect(() => {
    setShowDialogTargetText(targetPromptMode === "text");
  }, [targetPromptMode]);

  useEffect(() => {
    if (!showDialogsModal && !showQuestionsModal) {
      return;
    }
    let cancelled = false;
    const loadLatestItemHistory = async (): Promise<void> => {
      try {
        const detail = await fetchContentItemDetail(item.id, sourceLanguage, targetLanguage);
        if (cancelled) {
          return;
        }
        setItemQuestions(detail.item_questions || []);
      } catch {
        // Keep existing state if refresh fails.
      }
    };
    void loadLatestItemHistory();
    return () => {
      cancelled = true;
    };
  }, [showDialogsModal, showQuestionsModal, item.id, sourceLanguage, targetLanguage]);

  useEffect(() => {
    if (!showQuestionsModal) {
      return;
    }
    questionInputRef.current?.focus();
  }, [showQuestionsModal]);

  useEffect(() => {
    if (!showQuestionsModal) {
      return;
    }
    const historyElement = questionsHistoryRef.current;
    if (!historyElement) {
      return;
    }
    historyElement.scrollTo({
      top: historyElement.scrollHeight,
      behavior: "smooth",
    });
  }, [showQuestionsModal, itemQuestions, askingQuestion]);

  const wordCandidates = (word: string): string[] => {
    const normalized = word.trim();
    if (!normalized) {
      return [];
    }
    const candidates = [normalized];
    const withoutArticle = normalized.replace(/^(der|die|das)\s+/i, "").trim();
    if (withoutArticle && withoutArticle.toLowerCase() !== normalized.toLowerCase()) {
      candidates.push(withoutArticle);
    }
    return candidates.sort((a, b) => b.length - a.length);
  };

  const containsWordInTurn = (turnTargetText: string, word: string): boolean => {
    const text = turnTargetText.trim();
    if (!text) {
      return false;
    }
    for (const candidate of wordCandidates(word)) {
      const escaped = candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(`\\b${escaped}\\b`, "i");
      if (pattern.test(text)) {
        return true;
      }
    }
    return false;
  };
  const speakerForTurn = (speaker: string | undefined, index: number): "a" | "b" =>
    speaker === "a" || speaker === "b" ? speaker : (index % 2 === 0 ? "a" : "b");

  const playTurnAudio = async (phraseAudioUrl: string, turnIndex: number, includeWord: boolean): Promise<void> => {
    if (!phraseAudioUrl) {
      return;
    }
    const sequence: string[] = [];
    if (item.item_type === "word" && includeWord && item.audio_url) {
      sequence.push(item.audio_url);
    }
    sequence.push(phraseAudioUrl);
    for (let index = 0; index < sequence.length; index += 1) {
      const source = sequence[index];
      if (!source) {
        continue;
      }
      await new Promise<void>((resolve) => {
        const audio = new Audio(source);
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        void audio.play().catch(() => resolve());
      });
      if (index === 0 && item.item_type === "word" && turnIndex >= 0) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 120));
      }
    }
  };

  const playAudioUrl = (audioUrl?: string): void => {
    if (!audioUrl) {
      return;
    }
    const audio = new Audio(audioUrl);
    void audio.play().catch(() => undefined);
  };

  const cleanToken = (value: string): string => value.replace(/^[^A-Za-zÀ-ÖØ-öø-ÿ]+|[^A-Za-zÀ-ÖØ-öø-ÿ]+$/g, "").trim();

  const lineTokens = (line: string): string[] => line.split(/\s+/).filter((part) => part.trim().length > 0);

  const requestAddWordFromDialogToken = async (
    key: string,
    sourceTokenRaw: string,
    targetTokenRaw: string,
    dialogId?: number,
    turnIndex?: number,
    sourceContextLine = "",
    targetContextLine = "",
  ): Promise<void> => {
    const sourceToken = cleanToken(sourceTokenRaw);
    const targetToken = cleanToken(targetTokenRaw);
    if (!sourceToken || !targetToken) {
      return;
    }

    setWordActionStatus((current) => ({ ...current, [key]: "saving" }));
    try {
      const check = await quickAddWordFromDialog(
        sourceToken,
        targetToken,
        sourceLanguage,
        targetLanguage,
        dialogId,
        turnIndex,
        true,
        sourceContextLine,
        targetContextLine,
        targetToken,
      );
      if (check.exists && check.id) {
        setWordActionStatus((current) => ({ ...current, [key]: "exists" }));
        setLoadingLinkedWord(true);
        try {
          const detail = await fetchContentItemDetail(check.id, sourceLanguage, targetLanguage);
          setOpenedLinkedWord({
            id: detail.id,
            item_type: detail.item_type,
            spanish_text: detail.spanish_text,
            german_text: detail.german_text,
            example_sentence: detail.example_sentence || "",
            notes: detail.notes || "",
            audio_url: detail.audio_url || "",
            exercise_phrases: detail.exercise_phrases || {},
            mode: "new",
            direction: null,
            options: [],
            related_dialogs: detail.related_dialogs || [],
            item_questions: detail.item_questions || [],
          });
        } finally {
          setLoadingLinkedWord(false);
        }
        return;
      }
      setWordActionStatus((current) => ({ ...current, [key]: "idle" }));
      setPendingWordAdd({
        key,
        source: check.source_text || sourceToken,
        target: check.target_text || targetToken,
        dialogId,
        turnIndex,
      });
    } catch {
      setWordActionStatus((current) => ({ ...current, [key]: "error" }));
    }
  };

  const askItemQuestion = async (): Promise<void> => {
    const questionText = itemQuestionInput.trim();
    if (askingQuestion || !questionText) {
      return;
    }
    setAskingQuestion(true);
    setItemQuestionError("");
    try {
      const response = await askContentItemQuestion(item.id, questionText, sourceLanguage, targetLanguage);
      setItemQuestions(response.conversation || []);
      setItemQuestionInput("");
    } catch (error) {
      if (error instanceof Error && error.message) {
        setItemQuestionError(error.message);
      } else {
        setItemQuestionError(t("newItem.questionsError"));
      }
    } finally {
      setAskingQuestion(false);
    }
  };

  const confirmAddWordFromDialog = async (): Promise<void> => {
    if (!pendingWordAdd || addingWord) {
      return;
    }

    const { key, source, target, dialogId, turnIndex } = pendingWordAdd;
    setWordActionStatus((current) => ({ ...current, [key]: "saving" }));
    setAddingWord(true);
    try {
      const result = await quickAddWordFromDialog(source, target, sourceLanguage, targetLanguage, dialogId, turnIndex);
      setWordActionStatus((current) => ({ ...current, [key]: result.created ? "added" : "exists" }));
    } catch {
      setWordActionStatus((current) => ({ ...current, [key]: "error" }));
    } finally {
      setAddingWord(false);
      setPendingWordAdd(null);
    }
  };

  const renderTargetTurnWithLinks = ({
    dialogId,
    turnIndex,
    sourceText,
    targetText,
    highlightWord,
  }: {
    dialogId: number;
    turnIndex: number;
    sourceText: string;
    targetText: string;
    highlightWord?: string;
  }): JSX.Element => {
    const targetTokens = lineTokens(targetText);

    return (
      <>
        {targetTokens.map((token, tokenIndex) => {
          const targetToken = cleanToken(token);
          const isWordToken = targetToken.length > 0;
          if (!isWordToken) {
            return (
              <span key={`${dialogId}-${turnIndex}-punct-${tokenIndex}`} className="turn-token-wrap">
                {token}
                {tokenIndex < targetTokens.length - 1 ? " " : ""}
              </span>
            );
          }
          const statusKey = `${dialogId}-${turnIndex}-target-${tokenIndex}`;
          const status = wordActionStatus[statusKey] || "idle";
          const showHighlight = !!highlightWord && containsWordInTurn(token, highlightWord);
          return (
            <span key={statusKey} className="turn-token-wrap">
              <button
                type="button"
                className={`turn-token-button ${showHighlight ? "turn-word-highlight" : ""}`}
                onClick={() => void requestAddWordFromDialogToken(
                  statusKey,
                  targetToken,
                  targetToken,
                  dialogId,
                  turnIndex,
                  sourceText,
                  targetText,
                )}
                disabled={status === "saving"}
              >
                {token}
              </button>
              {tokenIndex < targetTokens.length - 1 ? " " : ""}
              {status === "saving" && <span className="turn-token-status">({t("newItem.wordAddSaving")})</span>}
              {status === "added" && <span className="turn-token-status">({t("newItem.wordAddAdded")})</span>}
              {status === "exists" && <span className="turn-token-status">({t("newItem.wordAddExists")})</span>}
              {status === "error" && <span className="turn-token-status">({t("newItem.wordAddError")})</span>}
            </span>
          );
        })}
      </>
    );
  };

  const sanitizeExerciseEntries = (entries?: Array<{ label?: string; source_text?: string; target_text?: string }>): Array<{ label: string; source: string; target: string }> => {
    if (!entries || !entries.length) {
      return [];
    }
    return entries
      .map((entry) => ({
        label: String(entry.label || "").trim(),
        source: String(entry.source_text || "").trim(),
        target: String(entry.target_text || "").trim(),
      }))
      .filter((entry) => entry.source && entry.target)
      .slice(0, MAX_EXERCISE_ENTRIES);
  };

  const exerciseEntryKey = (entry: { label?: string; source: string; target: string }): string => `${entry.label || ""}|||${entry.source}|||${entry.target}`;
  const savedExerciseEntries = sanitizeExerciseEntries(exercisePhrases?.phrases);
  const legacyExerciseEntries = [
    ...sanitizeExerciseEntries(exercisePhrases?.first_section),
    ...sanitizeExerciseEntries(exercisePhrases?.second_section),
  ];
  const generatedWordExerciseEntries = savedExerciseEntries.length ? savedExerciseEntries : legacyExerciseEntries;
  const wordExerciseEntries = item.item_type === "word"
    ? [
        {
          label: "word",
          source: item.spanish_text,
          target: item.german_text,
        },
        ...generatedWordExerciseEntries,
      ]
    : generatedWordExerciseEntries;
  const isVerbWord = item.item_type === "word" && String(item.word_type || "").trim().toLowerCase() === "verb";
  const hasVerbExerciseGridEntries = generatedWordExerciseEntries.some((entry) => Boolean(parseVerbExerciseLabel(entry.label)));
  const hasCurrentVerbExerciseGeneration = exercisePhrases?.generation_mode === VERB_BY_TENSE_GENERATION_MODE;
  const isVerbExerciseGrid = item.item_type === "word"
    && (isVerbWord || hasVerbExerciseGridEntries);
  const wordOnlyExerciseEntry = item.item_type === "word"
    ? wordExerciseEntries.find((entry) => entry.label === "word")
    : undefined;
  const verbExerciseGridEntries = generatedWordExerciseEntries
    .map((entry) => ({ entry, parsed: parseVerbExerciseLabel(entry.label) }))
    .filter((itemWithParsed): itemWithParsed is { entry: { label: string; source: string; target: string }; parsed: { tense: VerbTenseKey; person: VerbPersonKey } } => Boolean(itemWithParsed.parsed));
  const verbExerciseGridEntryBySlot = new Map(
    verbExerciseGridEntries.map(({ entry, parsed }) => [`${parsed.person}-${parsed.tense}`, entry]),
  );

  const selectedExerciseEntries = item.item_type === "phrase"
    ? [{ source: item.spanish_text, target: item.german_text }]
    : wordExerciseEntries.filter((entry) => selectedExerciseKeys.includes(exerciseEntryKey(entry)));
  const exerciseLines = selectedExerciseEntries.map((entry) => entry.target);
  const orderedItemQuestions = [...itemQuestions].sort((left, right) => left.id - right.id);

  const randomExerciseEntryKeys = (count: number): string[] => {
    const keys = wordExerciseEntries.map(exerciseEntryKey);
    if (keys.length <= count) {
      return keys;
    }
    return [...keys].sort(() => Math.random() - 0.5).slice(0, count);
  };

  const verbExerciseKeysForPerson = (person: VerbPersonKey): string[] => verbExerciseGridEntries
    .filter(({ parsed }) => parsed.person === person)
    .map(({ entry }) => exerciseEntryKey(entry));

  const verbExerciseKeysForTense = (tense: VerbTenseKey): string[] => verbExerciseGridEntries
    .filter(({ parsed }) => parsed.tense === tense)
    .map(({ entry }) => exerciseEntryKey(entry));

  const selectVerbExercisePerson = (person: VerbPersonKey): void => {
    setSelectedExerciseKeys(verbExerciseKeysForPerson(person));
  };

  const selectVerbExerciseTense = (tense: VerbTenseKey): void => {
    setSelectedExerciseKeys(verbExerciseKeysForTense(tense));
  };

  const selectRandomVerbExerciseGroup = (): void => {
    const groups = [
      ...VERB_PERSONS.map((person) => verbExerciseKeysForPerson(person.key)),
      ...VERB_TENSES.map((tense) => verbExerciseKeysForTense(tense.key)),
    ].filter((keys) => keys.length > 0);
    if (!groups.length) {
      setSelectedExerciseKeys([]);
      return;
    }
    setSelectedExerciseKeys(groups[Math.floor(Math.random() * groups.length)]);
  };

  useEffect(() => {
    if (!showExerciseModal || item.item_type !== "word") {
      setSelectedExerciseKeys([]);
      return;
    }
    if (isVerbExerciseGrid) {
      selectRandomVerbExerciseGroup();
      return;
    }
    setSelectedExerciseKeys(randomExerciseEntryKeys(2));
  }, [showExerciseModal, item.id, item.item_type, exercisePhrases]);

  const toggleExerciseEntry = (entry: { label?: string; source: string; target: string }): void => {
    const key = exerciseEntryKey(entry);
    setSelectedExerciseKeys((current) => (
      current.includes(key)
        ? current.filter((selectedKey) => selectedKey !== key)
        : [...current, key]
    ));
  };

  const selectAllExerciseEntries = (): void => {
    if (isVerbExerciseGrid) {
      setSelectedExerciseKeys(verbExerciseGridEntries.map(({ entry }) => exerciseEntryKey(entry)));
      return;
    }
    setSelectedExerciseKeys(wordExerciseEntries.map(exerciseEntryKey));
  };

  const selectRandomExerciseEntries = (): void => {
    if (isVerbExerciseGrid) {
      selectRandomVerbExerciseGroup();
      return;
    }
    setSelectedExerciseKeys(randomExerciseEntryKeys(2));
  };

  const unselectAllExerciseEntries = (): void => {
    setSelectedExerciseKeys([]);
  };

  const openExerciseModal = async (): Promise<void> => {
    if (showExerciseModal) {
      return;
    }
    setExerciseError("");
    if (
      item.item_type === "word"
      && item.id > 0
      && (
        generatedWordExerciseEntries.length === 0
        || (isVerbWord && (!hasVerbExerciseGridEntries || !hasCurrentVerbExerciseGeneration))
      )
    ) {
      setLoadingExercises(true);
      try {
        const payload = await generateContentItemExercises(item.id, sourceLanguage, targetLanguage);
        setExercisePhrases(payload.exercise_phrases || {});
      } catch {
        setExerciseError(t("newItem.exercisesGenerationError"));
      } finally {
        setLoadingExercises(false);
      }
    }
    setShowExerciseModal(true);
  };

  const playExerciseDoneSound = (): void => {
    if (typeof window === "undefined") {
      return;
    }
    const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }
    const audioContext = new AudioContextClass();
    const now = audioContext.currentTime;
    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.03, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    gain.connect(audioContext.destination);

    const oscillator = audioContext.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(659.25, now);
    oscillator.frequency.setValueAtTime(783.99, now + 0.2);
    oscillator.connect(gain);
    oscillator.start(now);
    oscillator.stop(now + 0.46);
    oscillator.onended = () => {
      void audioContext.close();
    };
  };

  const stopExercise = (resetToFullTime = true): void => {
    setExerciseRunning(false);
    setExerciseSecondsLeft(resetToFullTime ? 30 : 0);
    exerciseRunRef.current += 1;
    if (exerciseTimerRef.current !== null) {
      window.clearInterval(exerciseTimerRef.current);
      exerciseTimerRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (exerciseAudioRef.current) {
      exerciseAudioRef.current.pause();
      exerciseAudioRef.current.currentTime = 0;
      exerciseAudioRef.current = null;
    }
  };

  const playAudioSourcesOnce = async (sources: string[], runId: number): Promise<void> => {
    for (const source of sources) {
      if (!source || exerciseRunRef.current !== runId || !exerciseRunningRef.current) {
        continue;
      }
      await new Promise<void>((resolve) => {
        const audio = new Audio(source);
        exerciseAudioRef.current = audio;
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        void audio.play().catch(() => resolve());
      });
    }
    exerciseAudioRef.current = null;
  };

  const speakLinesOnce = async (lines: string[], runId: number): Promise<void> => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }
    window.speechSynthesis.cancel();
    for (const line of lines) {
      if (exerciseRunRef.current !== runId || !exerciseRunningRef.current) {
        return;
      }
      await new Promise<void>((resolve) => {
        const utterance = new SpeechSynthesisUtterance(line);
        const speechLangByCode: Record<StudyLanguageCode, string> = {
          spanish: "es-ES",
          english: "en-US",
          german: "de-DE",
          french: "fr-FR",
          italian: "it-IT",
          portuguese: "pt-PT",
        };
        utterance.lang = speechLangByCode[targetLanguage] || "de-DE";
        utterance.rate = 0.75;
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        window.speechSynthesis.speak(utterance);
      });
    }
  };

  const startExercise = (): void => {
    stopExercise();
    const runId = exerciseRunRef.current;
    setExerciseSecondsLeft(30);
    setExerciseRunning(true);
    exerciseRunningRef.current = true;
    exerciseTimerRef.current = window.setInterval(() => {
      setExerciseSecondsLeft((current) => {
        if (current <= 1) {
          stopExercise(false);
          playExerciseDoneSound();
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    const phraseExerciseAudioSources = item.item_type === "phrase" && item.audio_url ? [item.audio_url] : [];
    const playOnce = phraseExerciseAudioSources.length
      ? () => playAudioSourcesOnce(phraseExerciseAudioSources, runId)
      : () => speakLinesOnce(exerciseLines, runId);

    const loop = (): void => {
      if (exerciseRunRef.current !== runId || !exerciseRunningRef.current) {
        return;
      }
      void playOnce().then(() => {
        if (exerciseRunRef.current !== runId || !exerciseRunningRef.current) {
          return;
        }
        window.setTimeout(loop, 120);
      });
    };
    loop();
  };

  const closeExerciseModal = (): void => {
    stopExercise();
    setShowExerciseModal(false);
  };

  return (
    <div>
      <p className="prompt">{item.item_type === "word" ? t("newItem.word") : t("newItem.phrase")}</p>
      <p>
        <strong>{t("newItem.sourceLabel", { language: sourceLanguageLabel })}</strong> {item.spanish_text}
      </p>
      <p>
        <strong>{t("newItem.targetLabel", { language: targetLanguageLabel })}</strong> {item.german_text}
      </p>
      <p>
        <strong>{t("newItem.notes")}</strong> {item.notes || "-"}
      </p>
      {item.audio_url && (
        <>
          <audio controls src={item.audio_url}>
            {t("newItem.noAudioSupport")}
          </audio>
        </>
      )}
      {(item.item_type === "word" || item.item_type === "phrase") && (
        <div className="actions item-actions-toolbar">
          <button type="button" className="secondary-button item-action-button" onClick={() => setShowDialogsModal(true)}>
            {t("newItem.openRelatedDialogs")}
          </button>
          <button type="button" className="secondary-button item-action-button" onClick={() => void openExerciseModal()} disabled={loadingExercises}>
            {t("newItem.openExercises")}
          </button>
          <button type="button" className="secondary-button item-action-button" onClick={() => setShowQuestionsModal(true)}>
            {t("newItem.openQuestions")}
          </button>
        </div>
      )}
      {!readOnly && (
        <div className="actions">
          <button type="button" className="item-got-it-button" onClick={markAsSeen} disabled={saving}>
            {saving ? t("newItem.saving") : t("newItem.gotIt")}
          </button>
        </div>
      )}
      {readOnly && onClose && (
        <div className="actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            {t("words.close")}
          </button>
        </div>
      )}
      {showDialogsModal && (item.item_type === "word" || item.item_type === "phrase") && (
        <div className="blocking-modal-overlay" role="dialog" aria-modal="true">
          <div className="blocking-modal related-dialogs-modal">
            <p>
              <strong>{t("newItem.relatedDialogs", { count: item.related_dialogs?.length || 0 })}</strong>
            </p>
            {targetPromptMode === "audio" && (
              <div className="prompt-visibility-controls">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowDialogTargetText((value) => !value)}
                >
                  {showDialogTargetText ? t("prompt.hideText") : t("prompt.showText")}
                </button>
              </div>
            )}
            {!item.related_dialogs?.length && <p>{t("newItem.noRelatedDialogs")}</p>}
            {!!item.related_dialogs?.length && (
              <div className="related-dialogs-scroll">
                {(showAllDialogs ? item.related_dialogs : item.related_dialogs.slice(0, 2)).map((dialog) => {
                const matchedTurnIndexes = new Set(dialog.matched_turns.map((turn) => turn.turn_index));
                return (
                  <div key={dialog.dialog_id} className="related-dialog-card">
                    <p>
                      <strong>{dialog.topic}</strong>
                    </p>
                    <p>
                      <strong>{t("newItem.dialogContext")}:</strong> {dialog.context || t("newItem.dialogNoContext")}
                    </p>
                    {dialog.audio_url && (
                      <audio controls src={dialog.audio_url}>
                        {t("newItem.noAudioSupport")}
                      </audio>
                    )}
                    {!!dialog.turns.length && (
                      <>
                        <p><strong>{t("newItem.dialogTurns")}:</strong></p>
                        <ul className="conversation-preview-list">
                          {dialog.turns.map((turn, index) => {
                            const includeWord = item.item_type === "word" && containsWordInTurn(turn.target_text, item.german_text);
                            const speaker = speakerForTurn(turn.speaker, index);
                            return (
                              <li
                                key={`${dialog.dialog_id}-full-${index}`}
                                className={`conversation-turn ${speaker === "a" ? "speaker-a" : "speaker-b"} ${
                                  matchedTurnIndexes.has(index) ? "turn-highlight" : ""
                                }`}
                              >
                            <p className="conversation-speaker">
                              {speaker === "a" ? t("content.preview.personA") : t("content.preview.personB")}
                            </p>
                            <p className="conversation-line conversation-line-translation">
                              {hideDialogTargetText
                                ? <span className="prompt-audio-placeholder">{t("prompt.audioOnly")}</span>
                                : renderTargetTurnWithLinks({
                                  dialogId: dialog.dialog_id,
                                  turnIndex: index,
                                  sourceText: turn.source_text,
                                  targetText: turn.target_text,
                                  highlightWord: item.item_type === "word" ? item.german_text : "",
                                })}
                              <button
                                type="button"
                                className="turn-audio-button"
                                disabled={!turn.phrase_audio_url || (item.item_type === "word" && includeWord && !item.audio_url)}
                                onClick={() => void playTurnAudio(turn.phrase_audio_url || "", index, includeWord)}
                              >
                                {t("newItem.playTurnAudio")}
                              </button>
                            </p>
                            <p className="conversation-line">
                              {hideDialogTargetText
                                ? <span className="prompt-audio-placeholder">{t("prompt.audioOnly")}</span>
                                : turn.source_text}
                            </p>
                          </li>
                            );
                          })}
                      </ul>
                      </>
                    )}
                  </div>
                );
                })}
              </div>
            )}
            <div className="actions">
              {!!item.related_dialogs?.length && item.related_dialogs.length > 2 && (
                <button type="button" onClick={() => setShowAllDialogs((value) => !value)}>
                  {showAllDialogs ? t("newItem.hideMoreDialogs") : t("newItem.showMoreDialogs")}
                </button>
              )}
              <button type="button" onClick={() => setShowDialogsModal(false)}>
                {t("newItem.closeRelatedDialogs")}
              </button>
            </div>
          </div>
        </div>
      )}
      {showExerciseModal && (item.item_type === "word" || item.item_type === "phrase") && (
        <div className="blocking-modal-overlay" role="dialog" aria-modal="true">
          <div className={`blocking-modal related-dialogs-modal exercise-modal ${isVerbExerciseGrid ? "verb-exercise-modal" : ""}`}>
            <p>
              <strong>{t("newItem.exercisesTitle")}</strong>
            </p>
            <p className="hint">{t("newItem.exercisesDescription")}</p>
            {loadingExercises && <p className="hint">{t("newItem.exercisesGenerating")}</p>}
            {exerciseError && <p className="error">{exerciseError}</p>}
            {item.item_type === "word" && (
              <>
                <div className="exercise-selection-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={selectAllExerciseEntries}
                    disabled={exerciseRunning || wordExerciseEntries.length === 0}
                  >
                    {t("newItem.exercisesSelectAll")}
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={selectRandomExerciseEntries}
                    disabled={exerciseRunning || wordExerciseEntries.length === 0}
                  >
                    {t("newItem.exercisesRandomSelection")}
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={unselectAllExerciseEntries}
                    disabled={exerciseRunning || selectedExerciseKeys.length === 0}
                  >
                    {t("newItem.exercisesUnselectAll")}
                  </button>
                </div>
                {isVerbExerciseGrid ? (
                  <div className="verb-exercise-wrap">
                    {wordOnlyExerciseEntry && (
                      <label className={`exercise-phrase-row verb-word-row ${selectedExerciseKeys.includes(exerciseEntryKey(wordOnlyExerciseEntry)) ? "exercise-phrase-row-selected" : ""}`}>
                        <input
                          type="checkbox"
                          checked={selectedExerciseKeys.includes(exerciseEntryKey(wordOnlyExerciseEntry))}
                          onChange={() => toggleExerciseEntry(wordOnlyExerciseEntry)}
                          disabled={exerciseRunning}
                        />
                        <span>
                          <strong>{wordOnlyExerciseEntry.target}</strong>
                          <small>{wordOnlyExerciseEntry.source}</small>
                          <em className="exercise-phrase-label">{wordOnlyExerciseEntry.label}</em>
                        </span>
                      </label>
                    )}
                    <div className="verb-exercise-grid" role="table" aria-label={t("newItem.exercisesTitle")}>
                      <div className="verb-exercise-cell verb-exercise-corner" role="columnheader" />
                      {VERB_TENSES.map((tense) => {
                        const keys = verbExerciseKeysForTense(tense.key);
                        const selected = keys.length > 0 && keys.every((key) => selectedExerciseKeys.includes(key));
                        return (
                          <button
                            key={tense.key}
                            type="button"
                            className={`verb-exercise-cell verb-exercise-header ${selected ? "verb-exercise-selected" : ""}`}
                            onClick={() => selectVerbExerciseTense(tense.key)}
                            disabled={exerciseRunning || keys.length === 0}
                          >
                            {tense.label}
                          </button>
                        );
                      })}
                      {VERB_PERSONS.map((person) => {
                        const rowKeys = verbExerciseKeysForPerson(person.key);
                        const rowSelected = rowKeys.length > 0 && rowKeys.every((key) => selectedExerciseKeys.includes(key));
                        return (
                          <Fragment key={person.key}>
                            <button
                              key={`${person.key}-row`}
                              type="button"
                              className={`verb-exercise-cell verb-exercise-header verb-exercise-person ${rowSelected ? "verb-exercise-selected" : ""}`}
                              onClick={() => selectVerbExercisePerson(person.key)}
                              disabled={exerciseRunning || rowKeys.length === 0}
                            >
                              {person.label}
                            </button>
                            {VERB_TENSES.map((tense) => {
                              const entry = verbExerciseGridEntryBySlot.get(`${person.key}-${tense.key}`);
                              const key = entry ? exerciseEntryKey(entry) : `${person.key}-${tense.key}`;
                              const selected = entry ? selectedExerciseKeys.includes(key) : false;
                              if (!entry) {
                                return (
                                  <div key={key} className="verb-exercise-cell verb-exercise-entry" role="cell">
                                    <span className="manage-item-meta">-</span>
                                  </div>
                                );
                              }
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  className={`verb-exercise-cell verb-exercise-entry ${selected ? "verb-exercise-selected" : ""}`}
                                  onClick={() => toggleExerciseEntry(entry)}
                                  disabled={exerciseRunning}
                                >
                                  <strong>{entry.target}</strong>
                                  <small>{entry.source}</small>
                                </button>
                              );
                            })}
                          </Fragment>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="exercise-phrase-list">
                    {wordExerciseEntries.map((entry) => {
                      const key = exerciseEntryKey(entry);
                      const checked = selectedExerciseKeys.includes(key);
                      return (
                        <label className={`exercise-phrase-row ${checked ? "exercise-phrase-row-selected" : ""}`} key={key}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleExerciseEntry(entry)}
                            disabled={exerciseRunning}
                          />
                          <span>
                            <strong>{entry.target}</strong>
                            <small>{entry.source}</small>
                            {entry.label && <em className="exercise-phrase-label">{entry.label}</em>}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </>
            )}
            {item.item_type === "word" && wordExerciseEntries.length === 0 && (
              <p className="hint">{t("newItem.exercisesUnavailable")}</p>
            )}
            {item.item_type === "phrase" && (
              <div className="exercise-section-grid">
                <div className="exercise-section-card exercise-section-card-selected">
                  <strong>{t("newItem.exercisesPhraseTitle")}</strong>
                  <ul>
                    <li>{item.german_text}</li>
                  </ul>
                  <div className="exercise-translation-group">
                    {sourceLanguageLabel}: {item.spanish_text}
                  </div>
                </div>
              </div>
            )}

            <p className="exercise-timer">
              <strong>{t("newItem.exercisesTimeLeft", { seconds: exerciseSecondsLeft })}</strong>
            </p>

            <div className="actions">
              {!exerciseRunning && (
                <button type="button" onClick={startExercise} disabled={exerciseLines.length === 0}>
                  {t("newItem.exercisesStart")}
                </button>
              )}
              {exerciseRunning && (
                <button type="button" className="secondary-button" onClick={stopExercise}>
                  {t("newItem.exercisesStop")}
                </button>
              )}
              <button type="button" className="secondary-button" onClick={closeExerciseModal}>
                {t("newItem.closeRelatedDialogs")}
              </button>
            </div>
          </div>
        </div>
      )}
      {showQuestionsModal && (item.item_type === "word" || item.item_type === "phrase") && (
        <div className="blocking-modal-overlay" role="dialog" aria-modal="true">
          <div className="blocking-modal related-dialogs-modal questions-modal">
            <p>
              <strong>{t("newItem.questionsTitle")}</strong>
            </p>
            <div className="questions-modal-item-texts">
              <p className="questions-modal-item-text">
                <strong>{t("newItem.sourceLabel", { language: sourceLanguageLabel })}</strong> {item.spanish_text}
              </p>
              <p className="questions-modal-item-text">
                <strong>{t("newItem.targetLabel", { language: targetLanguageLabel })}</strong> {item.german_text}
              </p>
            </div>
            {!!itemQuestions.length && (
              <div ref={questionsHistoryRef} className="item-questions-history item-chat-thread">
                {orderedItemQuestions.map((entry, index) => (
                  <article
                    key={entry.id}
                    className="item-question-entry item-chat-entry"
                    tabIndex={index === orderedItemQuestions.length - 1 ? -1 : undefined}
                  >
                    <div className="item-chat-message item-chat-user">
                      <p className="item-chat-meta">{t("newItem.questionsLabelQuestion")}</p>
                      <p className="item-chat-bubble">{entry.question_text}</p>
                    </div>
                    <div className="item-chat-message item-chat-assistant">
                      <p className="item-chat-meta">{t("newItem.questionsLabelAnswer")}</p>
                      <p className="item-chat-bubble">{entry.answer_text}</p>
                    </div>
                  </article>
                ))}
              </div>
            )}
            <form
              className="item-questions-actions"
              onSubmit={(event) => {
                event.preventDefault();
                void askItemQuestion();
              }}
            >
              <input
                ref={questionInputRef}
                value={itemQuestionInput}
                onChange={(event) => setItemQuestionInput(event.target.value)}
                placeholder={t("newItem.questionsPlaceholder")}
                disabled={askingQuestion}
              />
              <button type="submit" disabled={askingQuestion || !itemQuestionInput.trim()}>
                {askingQuestion ? t("newItem.questionsLoading") : t("newItem.questionsAskButton")}
              </button>
            </form>
            {itemQuestionError && <p className="error">{itemQuestionError}</p>}
            <div className="actions">
              <button type="button" className="secondary-button" onClick={() => setShowQuestionsModal(false)}>
                {t("newItem.closeRelatedDialogs")}
              </button>
            </div>
          </div>
        </div>
      )}
      {pendingWordAdd && (
        <div className="blocking-modal-overlay" role="dialog" aria-modal="true">
          <div className="blocking-modal add-word-modal">
            <p className="add-word-modal-title">
              <strong>{t("newItem.wordAddTitle")}</strong>
            </p>
            <p className="add-word-modal-word">{pendingWordAdd.target}</p>
            <p className="add-word-modal-meaning">
              {t("newItem.wordAddMeaning", { translation: pendingWordAdd.source })}
            </p>
            <p className="hint">{t("newItem.wordAddPrompt")}</p>
            <div className="actions">
              <button type="button" className="secondary-button" onClick={() => setPendingWordAdd(null)} disabled={addingWord}>
                {t("newItem.wordAddCancel")}
              </button>
              <button type="button" onClick={() => void confirmAddWordFromDialog()} disabled={addingWord}>
                {addingWord ? t("newItem.wordAddSaving") : t("newItem.wordAddConfirmButton")}
              </button>
            </div>
          </div>
        </div>
      )}
      {loadingLinkedWord && (
        <div className="blocking-modal-overlay" role="dialog" aria-modal="true">
          <div className="blocking-modal add-word-modal">
            <p>{t("session.loading")}</p>
          </div>
        </div>
      )}
      {openedLinkedWord && (
        <div className="blocking-modal-overlay" role="dialog" aria-modal="true">
          <div className="blocking-modal words-item-modal">
            <NewItem item={openedLinkedWord} readOnly onClose={() => setOpenedLinkedWord(null)} />
          </div>
        </div>
      )}
    </div>
  );
}
