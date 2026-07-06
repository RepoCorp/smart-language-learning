import { Fragment, useEffect, useRef, useState, type FocusEvent, type PointerEvent } from "react";

import {
  addContentItemCompareWords,
  askContentItemQuestion,
  fetchContentItemDetail,
  generateContentDialogTurnAudio,
  generateContentItemExercises,
  generateContentItemFunnyImageExercise,
  quickAddPhraseFromConversation,
  quickAddWordFromDialog,
  regenerateContentDialogAudio,
  regenerateContentItemAudio,
  removeContentItemCompareWord,
  refreshContentItemWord,
  searchContentItemCompareWords,
  submitReview,
} from "../api";
import { deterministicIndex, deterministicNumber, deterministicTake } from "../deterministic";
import { useI18n } from "../i18n";
import { usePromptPreferences } from "../promptPreferences";
import { type StudyLanguageCode, useStudyLanguages } from "../studyLanguages";
import type { SessionItem } from "../types";
import DangerousButton from "./DangerousButton";
import DialogActionIcon from "./DialogActionIcon";
import DialogTurnsList from "./DialogTurnsList";
import PhraseReview from "./PhraseReview";
import WordReview from "./WordReview";

interface NewItemProps {
  item: SessionItem;
  onContinue?: () => Promise<void>;
  continueLabel?: string;
  autoplayAudioOnMount?: boolean;
  readOnly?: boolean;
  onClose?: () => void;
}

const MAX_EXERCISE_ENTRIES = 30;
const VERB_BY_TENSE_GENERATION_MODE = "verb_by_tense_v1";
const EXERCISE_PHRASE_PAUSE_MS = 650;
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
type ItemActionIconName =
  | "test"
  | "exercise"
  | "warmup"
  | "letters"
  | "builder"
  | "dialogMatch"
  | "dialogs"
  | "questions"
  | "audio"
  | "selectAll"
  | "clearAll"
  | "random"
  | "image"
  | "openImage"
  | "refresh";

function ItemActionIcon({ name }: { name: ItemActionIconName }): JSX.Element {
  const commonProps = {
    className: "item-action-icon",
    viewBox: "0 0 24 24",
    "aria-hidden": true,
  };

  if (name === "exercise") {
    return (
      <svg {...commonProps}>
        <path d="M8 5v14l11-7-11-7Z" />
        <path d="M4 6h1M4 12h1M4 18h1" />
      </svg>
    );
  }
  if (name === "test") {
    return (
      <svg {...commonProps}>
        <path d="M5 12h6" />
        <path d="m9 8 4 4-4 4" />
        <path d="M14 7h5v10h-5" />
      </svg>
    );
  }
  if (name === "warmup") {
    return (
      <svg {...commonProps}>
        <path d="M12 3l1.4 4.2L18 9l-4.6 1.8L12 15l-1.4-4.2L6 9l4.6-1.8L12 3Z" />
        <path d="M6 15l.7 2.1L9 18l-2.3.9L6 21l-.7-2.1L3 18l2.3-.9L6 15Z" />
      </svg>
    );
  }
  if (name === "letters") {
    return (
      <svg {...commonProps}>
        <path d="M4 18 9 6l5 12" />
        <path d="M6 14h6" />
        <path d="M16 8h4M18 6v4" />
      </svg>
    );
  }
  if (name === "builder") {
    return (
      <svg {...commonProps}>
        <rect x="3" y="5" width="7" height="5" rx="1" />
        <rect x="14" y="5" width="7" height="5" rx="1" />
        <rect x="8" y="14" width="8" height="5" rx="1" />
      </svg>
    );
  }
  if (name === "dialogMatch") {
    return (
      <svg {...commonProps}>
        <path d="M4 7h10l3 3H4V7Z" />
        <path d="M20 17H10l-3-3h13v3Z" />
      </svg>
    );
  }
  if (name === "dialogs") {
    return (
      <svg {...commonProps}>
        <path d="M4 5h11v8H8l-4 4V5Z" />
        <path d="M13 11h7v7l-3-3h-4" />
      </svg>
    );
  }
  if (name === "questions") {
    return (
      <svg {...commonProps}>
        <path d="M9 9a3 3 0 1 1 4.4 2.6c-.9.5-1.4 1.1-1.4 2.4" />
        <path d="M12 18h.01" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    );
  }
  if (name === "audio") {
    return (
      <svg {...commonProps}>
        <path d="M4 10v4h4l4 3V7l-4 3H4Z" />
        <path d="M15.5 9.5a3.5 3.5 0 0 1 0 5" />
        <path d="M19 5v4h-4" />
        <path d="M15 19v-4h4" />
        <path d="M19 9a7 7 0 0 0-11-3.6" />
        <path d="M15 15a7 7 0 0 1-11 3.6" />
      </svg>
    );
  }
  if (name === "selectAll") {
    return (
      <svg {...commonProps}>
        <rect x="4" y="5" width="16" height="14" rx="2" />
        <path d="m8.5 12 2.2 2.2 4.8-5.2" />
      </svg>
    );
  }
  if (name === "clearAll") {
    return (
      <svg {...commonProps}>
        <rect x="4" y="5" width="16" height="14" rx="2" />
        <path d="m9 10 6 6" />
        <path d="m15 10-6 6" />
      </svg>
    );
  }
  if (name === "random") {
    return (
      <svg {...commonProps}>
        <path d="M4 8h3l4 8h3" />
        <path d="M14 8h6" />
        <path d="m17 5 3 3-3 3" />
        <path d="M4 16h3l2-4" />
        <path d="M14 16h6" />
        <path d="m17 13 3 3-3 3" />
      </svg>
    );
  }
  if (name === "image") {
    return (
      <svg {...commonProps}>
        <rect x="4" y="5" width="16" height="14" rx="2" />
        <circle cx="9" cy="10" r="1.5" />
        <path d="m6 17 4-4 3 3 2-2 3 3" />
      </svg>
    );
  }
  if (name === "openImage") {
    return (
      <svg {...commonProps}>
        <rect x="4" y="7" width="10" height="10" rx="2" />
        <path d="M13 5h6v6" />
        <path d="m19 5-8 8" />
      </svg>
    );
  }
  return (
    <svg {...commonProps}>
      <path d="M20 12a8 8 0 0 1-13.7 5.7" />
      <path d="M4 12A8 8 0 0 1 17.7 6.3" />
      <path d="M17 3v4h4" />
      <path d="M7 21v-4H3" />
    </svg>
  );
}

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

export default function NewItem({
  item,
  onContinue,
  continueLabel,
  autoplayAudioOnMount = false,
  readOnly = false,
  onClose,
}: NewItemProps): JSX.Element {
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
  const [showDirectTestModal, setShowDirectTestModal] = useState<boolean>(false);
  const [directTestReviewComplete, setDirectTestReviewComplete] = useState<boolean>(false);
  const [directTestCorrect, setDirectTestCorrect] = useState<boolean | null>(null);
  const [directTestResetVersion, setDirectTestResetVersion] = useState<number>(0);
  const [showWordIntroPracticeModal, setShowWordIntroPracticeModal] = useState<boolean>(false);
  const [showWordLetterPracticeModal, setShowWordLetterPracticeModal] = useState<boolean>(false);
  const [showPhraseBuilderModal, setShowPhraseBuilderModal] = useState<boolean>(false);
  const [showFunnyImageModal, setShowFunnyImageModal] = useState<boolean>(false);
  const [itemActionTooltip, setItemActionTooltip] = useState<{ label: string; left: number; top: number } | null>(null);
  const [loadingExercises, setLoadingExercises] = useState<boolean>(false);
  const [refreshingWord, setRefreshingWord] = useState<boolean>(false);
  const [regeneratingAudio, setRegeneratingAudio] = useState<boolean>(false);
  const [generatingFunnyImageExercise, setGeneratingFunnyImageExercise] = useState<boolean>(false);
  const [exerciseError, setExerciseError] = useState<string>("");
  const [wordRefreshMessage, setWordRefreshMessage] = useState<string>("");
  const [showQuestionsModal, setShowQuestionsModal] = useState<boolean>(false);
  const [selectedExerciseKeys, setSelectedExerciseKeys] = useState<string[]>([]);
  const [exerciseSecondsLeft, setExerciseSecondsLeft] = useState<number>(30);
  const [exerciseRunning, setExerciseRunning] = useState<boolean>(false);
  const [exerciseMuted, setExerciseMuted] = useState<boolean>(false);
  const [wordActionStatus, setWordActionStatus] = useState<Record<string, "idle" | "saving" | "added" | "exists" | "error">>({});
  const [phraseActionStatus, setPhraseActionStatus] = useState<Record<string, "idle" | "saving" | "added" | "exists" | "error">>({});
  const [phraseActionError, setPhraseActionError] = useState<Record<string, string>>({});
  const [pendingWordAdd, setPendingWordAdd] = useState<{
    key: string;
    source: string;
    target: string;
    wordType: string;
    dialogId?: number;
    turnIndex?: number;
    sourceLine: string;
    targetLine: string;
    clickedTargetToken: string;
    note: string;
  } | null>(null);
  const [addingWord, setAddingWord] = useState<boolean>(false);
  const [openedLinkedWord, setOpenedLinkedWord] = useState<SessionItem | null>(null);
  const [loadingLinkedWord, setLoadingLinkedWord] = useState<boolean>(false);
  const [regeneratingRelatedDialogId, setRegeneratingRelatedDialogId] = useState<number | null>(null);
  const [itemQuestions, setItemQuestions] = useState<NonNullable<SessionItem["item_questions"]>>(item.item_questions || []);
  const [exercisePhrases, setExercisePhrases] = useState(item.exercise_phrases || {});
  const [sourceText, setSourceText] = useState<string>(item.spanish_text || "");
  const [targetText, setTargetText] = useState<string>(item.german_text || "");
  const [audioUrl, setAudioUrl] = useState<string>(item.audio_url || "");
  const [wordType, setWordType] = useState<string>(item.word_type || "");
  const [dialogPhraseAnswer, setDialogPhraseAnswer] = useState<string>(item.dialog_phrase_answer || "");
  const [dialogPhraseScene, setDialogPhraseScene] = useState<string>(item.dialog_phrase_scene || "");
  const [dialogPhraseSceneAudioUrls, setDialogPhraseSceneAudioUrls] = useState<string[]>(item.dialog_phrase_scene_audio_urls || []);
  const [dialogPhraseOptions, setDialogPhraseOptions] = useState<string[]>(item.dialog_phrase_options || []);
  const [dialogPhraseTurns, setDialogPhraseTurns] = useState<NonNullable<SessionItem["dialog_phrase_turns"]>>(item.dialog_phrase_turns || []);
  const [dialogPhraseOddIndex, setDialogPhraseOddIndex] = useState<number | null>(item.dialog_phrase_odd_index ?? null);
  const [relatedDialogs, setRelatedDialogs] = useState<NonNullable<SessionItem["related_dialogs"]>>(item.related_dialogs || []);
  const [compareWords, setCompareWords] = useState<NonNullable<SessionItem["compare_words"]>>(item.compare_words || []);
  const [showCompareWordsModal, setShowCompareWordsModal] = useState<boolean>(false);
  const [compareWordsQuery, setCompareWordsQuery] = useState<string>("");
  const [compareWordsResults, setCompareWordsResults] = useState<NonNullable<SessionItem["compare_words"]>>([]);
  const [selectedCompareWordIds, setSelectedCompareWordIds] = useState<number[]>([]);
  const [compareWordsPage, setCompareWordsPage] = useState<number>(1);
  const [compareWordsHasMore, setCompareWordsHasMore] = useState<boolean>(false);
  const [loadingCompareWords, setLoadingCompareWords] = useState<boolean>(false);
  const [savingCompareWords, setSavingCompareWords] = useState<boolean>(false);
  const [compareWordsError, setCompareWordsError] = useState<string>("");
  const [playingRelatedDialogId, setPlayingRelatedDialogId] = useState<number | null>(null);
  const [playingRelatedDialogTurn, setPlayingRelatedDialogTurn] = useState<{ dialogId: number; turnIndex: number } | null>(null);
  const [loadingRelatedDialogAudioKey, setLoadingRelatedDialogAudioKey] = useState<string>("");
  const [itemQuestionError, setItemQuestionError] = useState<string>("");
  const [itemQuestionInput, setItemQuestionInput] = useState<string>("");
  const [askingQuestion, setAskingQuestion] = useState<boolean>(false);
  const [showDialogTargetTextById, setShowDialogTargetTextById] = useState<Record<number, boolean>>({});
  const exerciseTimerRef = useRef<number | null>(null);
  const exerciseRunRef = useRef<number>(0);
  const exerciseRunningRef = useRef<boolean>(false);
  const exerciseMutedRef = useRef<boolean>(false);
  const exerciseAudioRef = useRef<HTMLAudioElement | null>(null);
  const relatedDialogPlaybackRunRef = useRef<number>(0);
  const relatedDialogAudioRef = useRef<HTMLAudioElement | null>(null);
  const relatedDialogsScrollRef = useRef<HTMLDivElement | null>(null);
  const relatedDialogCardRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const questionsHistoryRef = useRef<HTMLDivElement | null>(null);
  const questionInputRef = useRef<HTMLInputElement | null>(null);
  const autoplayedAudioKeyRef = useRef<string>("");

  useEffect(() => {
    setExercisePhrases(item.exercise_phrases || {});
    setExerciseError("");
    setWordRefreshMessage("");
    setSourceText(item.spanish_text || "");
    setTargetText(item.german_text || "");
    setAudioUrl(item.audio_url || "");
    setWordType(item.word_type || "");
    setDialogPhraseAnswer(item.dialog_phrase_answer || "");
    setDialogPhraseScene(item.dialog_phrase_scene || "");
    setDialogPhraseSceneAudioUrls(item.dialog_phrase_scene_audio_urls || []);
    setDialogPhraseOptions(item.dialog_phrase_options || []);
    setDialogPhraseTurns(item.dialog_phrase_turns || []);
    setDialogPhraseOddIndex(item.dialog_phrase_odd_index ?? null);
    setRelatedDialogs(item.related_dialogs || []);
    setCompareWords(item.compare_words || []);
  }, [item.id, item.spanish_text, item.german_text, item.audio_url, item.exercise_phrases, item.word_type, item.dialog_phrase_answer, item.dialog_phrase_scene, item.dialog_phrase_scene_audio_urls, item.dialog_phrase_options, item.dialog_phrase_turns, item.dialog_phrase_odd_index, item.related_dialogs, item.compare_words]);

  useEffect(() => {
    if (!autoplayAudioOnMount || !audioUrl) {
      return;
    }
    const autoplayKey = `${item.id}:${audioUrl}`;
    if (autoplayedAudioKeyRef.current === autoplayKey) {
      return;
    }
    autoplayedAudioKeyRef.current = autoplayKey;
    playAudioUrl(audioUrl);
  }, [autoplayAudioOnMount, audioUrl, item.id]);

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
      if (
        showQuestionsModal
        || showDialogsModal
        || showCompareWordsModal
        || showExerciseModal
        || showDirectTestModal
        || showWordIntroPracticeModal
        || showWordLetterPracticeModal
        || showPhraseBuilderModal
      ) {
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
  }, [saving, onContinue, readOnly, showQuestionsModal, showDialogsModal, showCompareWordsModal, showExerciseModal, showDirectTestModal, showWordIntroPracticeModal, showWordLetterPracticeModal, showPhraseBuilderModal]);

  useEffect(() => {
    if (!showDialogsModal) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      const activeTurn = document.querySelector(".related-dialogs-modal .turn-active-highlight");
      if (activeTurn instanceof HTMLElement) {
        activeTurn.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      const firstMatch = document.querySelector(".related-dialogs-modal .turn-highlight");
      if (firstMatch instanceof HTMLElement) {
        firstMatch.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 30);
    return () => window.clearTimeout(timeoutId);
  }, [showDialogsModal, relatedDialogs, playingRelatedDialogTurn]);

  useEffect(() => {
    exerciseRunningRef.current = exerciseRunning;
  }, [exerciseRunning]);

  useEffect(() => {
    exerciseMutedRef.current = exerciseMuted;
    if (!exerciseMuted) {
      return;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (exerciseAudioRef.current) {
      exerciseAudioRef.current.pause();
      exerciseAudioRef.current.currentTime = 0;
    }
  }, [exerciseMuted]);

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
    setShowWordIntroPracticeModal(false);
    setShowWordLetterPracticeModal(false);
    setShowPhraseBuilderModal(false);
    setShowCompareWordsModal(false);
    setCompareWordsError("");
    setCompareWordsQuery("");
    setCompareWordsResults([]);
    setSelectedCompareWordIds([]);
    setCompareWordsPage(1);
    setCompareWordsHasMore(false);
  }, [item.id, item.item_questions]);

  useEffect(() => {
    setShowDialogTargetTextById({});
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
    setShowDialogTargetTextById({});
  }, [item.id]);

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

  useEffect(() => {
    if (!showCompareWordsModal || item.item_type !== "word") {
      return;
    }
    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      void loadCompareWordsSearch(1, compareWordsQuery).catch(() => {
        if (!cancelled) {
          setCompareWordsError(t("newItem.compareWordsLoadError"));
        }
      });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [showCompareWordsModal, compareWordsQuery, item.item_type, t]);

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

  const stopRelatedDialogPlayback = (): void => {
    relatedDialogPlaybackRunRef.current += 1;
    if (relatedDialogAudioRef.current) {
      relatedDialogAudioRef.current.pause();
      relatedDialogAudioRef.current.currentTime = 0;
      relatedDialogAudioRef.current = null;
    }
    setPlayingRelatedDialogId(null);
    setPlayingRelatedDialogTurn(null);
  };

  const playRelatedDialogAudioUrl = (audioSource: string, runId: number): Promise<void> =>
    new Promise((resolve) => {
      if (!audioSource || runId !== relatedDialogPlaybackRunRef.current) {
        resolve();
        return;
      }
      const audio = new Audio(audioSource);
      relatedDialogAudioRef.current = audio;
      const finish = (): void => {
        audio.removeEventListener("ended", finish);
        audio.removeEventListener("error", finish);
        if (relatedDialogAudioRef.current === audio) {
          relatedDialogAudioRef.current = null;
        }
        resolve();
      };
      audio.addEventListener("ended", finish);
      audio.addEventListener("error", finish);
      void audio.play().catch(finish);
    });

  const updateRelatedDialogTurnAudioUrl = (dialogId: number, turnIndex: number, phraseAudioUrl: string): void => {
    setRelatedDialogs((current) => current.map((dialog) => {
      if (dialog.dialog_id !== dialogId) {
        return dialog;
      }
      return {
        ...dialog,
        turns: dialog.turns.map((turn, index) => (
          index === turnIndex ? { ...turn, phrase_audio_url: phraseAudioUrl } : turn
        )),
      };
    }));
  };

  const ensureRelatedDialogTurnAudioUrl = async (dialogId: number, turnIndex: number, currentAudioUrl = ""): Promise<string> => {
    if (currentAudioUrl) {
      return currentAudioUrl;
    }
    const key = `${dialogId}:${turnIndex}`;
    setLoadingRelatedDialogAudioKey(key);
    try {
      const generatedAudioUrl = await generateContentDialogTurnAudio(dialogId, turnIndex, sourceLanguage, targetLanguage);
      if (generatedAudioUrl) {
        updateRelatedDialogTurnAudioUrl(dialogId, turnIndex, generatedAudioUrl);
      }
      return generatedAudioUrl;
    } catch {
      setExerciseError(t("dialogs.error.load"));
      return "";
    } finally {
      setLoadingRelatedDialogAudioKey((current) => (current === key ? "" : current));
    }
  };

  type RelatedDialog = NonNullable<SessionItem["related_dialogs"]>[number];

  const playRelatedDialog = async (dialog: RelatedDialog): Promise<void> => {
    if (!dialog.turns.length) {
      return;
    }
    stopRelatedDialogPlayback();
    relatedDialogPlaybackRunRef.current += 1;
    const runId = relatedDialogPlaybackRunRef.current;
    setPlayingRelatedDialogId(dialog.dialog_id);

    for (let index = 0; index < dialog.turns.length; index += 1) {
      if (runId !== relatedDialogPlaybackRunRef.current) {
        break;
      }
      setPlayingRelatedDialogTurn({ dialogId: dialog.dialog_id, turnIndex: index });
      const audioSource = await ensureRelatedDialogTurnAudioUrl(dialog.dialog_id, index, dialog.turns[index].phrase_audio_url || "");
      await playRelatedDialogAudioUrl(audioSource, runId);
    }

    if (runId === relatedDialogPlaybackRunRef.current) {
      setPlayingRelatedDialogId(null);
      setPlayingRelatedDialogTurn(null);
    }
  };

  useEffect(() => {
    if (!showDialogsModal) {
      stopRelatedDialogPlayback();
    }
  }, [showDialogsModal]);

  useEffect(() => () => {
    stopRelatedDialogPlayback();
  }, []);

  const playTurnAudio = async (phraseAudioUrl: string): Promise<void> => {
    if (!phraseAudioUrl) {
      return;
    }
    await new Promise<void>((resolve) => {
      const audio = new Audio(phraseAudioUrl);
      audio.onended = () => resolve();
      audio.onerror = () => resolve();
      void audio.play().catch(() => resolve());
    });
  };

  const playAudioUrl = (audioUrl?: string): void => {
    if (!audioUrl) {
      return;
    }
    const audio = new Audio(audioUrl);
    void audio.play().catch(() => undefined);
  };

  const scrollToNextRelatedDialog = (currentDialogId?: number): void => {
    const visibleDialogs = showAllDialogs ? relatedDialogs : relatedDialogs.slice(0, 2);
    if (!visibleDialogs.length) {
      return;
    }
    const currentIndex = currentDialogId === undefined
      ? -1
      : visibleDialogs.findIndex((dialog) => dialog.dialog_id === currentDialogId);
    const nextDialog = currentIndex >= 0
      ? visibleDialogs[(currentIndex + 1) % visibleDialogs.length]
      : visibleDialogs[0];
    const nextElement = relatedDialogCardRefs.current.get(nextDialog.dialog_id);
    nextElement?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const cleanToken = (value: string): string => value.replace(/^[^A-Za-zÀ-ÖØ-öø-ÿ]+|[^A-Za-zÀ-ÖØ-öø-ÿ]+$/g, "").trim();

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
            word_type: detail.word_type || check.word_type || "",
            audio_url: detail.audio_url || "",
            exercise_phrases: detail.exercise_phrases || {},
            mode: "new",
            direction: null,
            options: [],
            dialog_phrase_answer: detail.dialog_phrase_answer || "",
            dialog_phrase_scene: detail.dialog_phrase_scene || "",
            dialog_phrase_scene_audio_urls: detail.dialog_phrase_scene_audio_urls || [],
            dialog_phrase_options: detail.dialog_phrase_options || [],
            dialog_phrase_turns: detail.dialog_phrase_turns || [],
            dialog_phrase_odd_index: detail.dialog_phrase_odd_index ?? null,
            related_dialogs: detail.related_dialogs || [],
            compare_words: detail.compare_words || [],
            item_questions: detail.item_questions || [],
          });
        } finally {
          setLoadingLinkedWord(false);
        }
        return;
      }
      setWordActionStatus((current) => ({ ...current, [key]: "idle" }));
      const resolvedWordType = String(check.word_type || "").trim();
      if (!resolvedWordType) {
        setWordActionStatus((current) => ({ ...current, [key]: "error" }));
        return;
      }
      setPendingWordAdd({
        key,
        source: check.source_text || sourceToken,
        target: check.target_text || targetToken,
        wordType: resolvedWordType,
        dialogId,
        turnIndex,
        sourceLine: sourceContextLine,
        targetLine: targetContextLine,
        clickedTargetToken: targetToken,
        note: check.notes || "",
      });
    } catch {
      setWordActionStatus((current) => ({ ...current, [key]: "error" }));
    }
  };

  const openLinkedDialogItem = async (itemId: number): Promise<void> => {
    setLoadingLinkedWord(true);
    try {
      const detail = await fetchContentItemDetail(itemId, sourceLanguage, targetLanguage);
      setOpenedLinkedWord({
        id: detail.id,
        item_type: detail.item_type,
        spanish_text: detail.spanish_text,
        german_text: detail.german_text,
        example_sentence: detail.example_sentence || "",
        notes: detail.notes || "",
        word_type: detail.word_type || "",
        audio_url: detail.audio_url || "",
        exercise_phrases: detail.exercise_phrases || {},
        mode: "new",
        direction: null,
        options: [],
        dialog_phrase_answer: detail.dialog_phrase_answer || "",
        dialog_phrase_scene: detail.dialog_phrase_scene || "",
        dialog_phrase_scene_audio_urls: detail.dialog_phrase_scene_audio_urls || [],
        dialog_phrase_options: detail.dialog_phrase_options || [],
        dialog_phrase_turns: detail.dialog_phrase_turns || [],
        dialog_phrase_odd_index: detail.dialog_phrase_odd_index ?? null,
        related_dialogs: detail.related_dialogs || [],
        compare_words: detail.compare_words || [],
        item_questions: detail.item_questions || [],
      });
    } finally {
      setLoadingLinkedWord(false);
    }
  };

  const wholeTurnPhraseKey = (dialogId: number, turnIndex: number): string => `related-${dialogId}-turn-${turnIndex}-whole-phrase`;

  const addWholeTurnPhraseFromRelatedDialog = async (
    dialogId: number,
    turn: { source_text: string; target_text: string; speaker?: "a" | "b"; phrase_audio_url?: string },
    turnIndex: number,
  ): Promise<void> => {
    if (!turn.source_text.trim() || !turn.target_text.trim()) {
      return;
    }
    const statusKey = wholeTurnPhraseKey(dialogId, turnIndex);
    setPhraseActionStatus((current) => ({ ...current, [statusKey]: "saving" }));
    setPhraseActionError((current) => ({ ...current, [statusKey]: "" }));
    try {
      const resultPayload = await quickAddPhraseFromConversation(
        turn.source_text,
        turn.target_text,
        sourceLanguage,
        targetLanguage,
        false,
        dialogId,
        turnIndex,
        turn.source_text,
        turn.target_text,
      );
      if (resultPayload.id) {
        await openLinkedDialogItem(resultPayload.id);
      }
      setPhraseActionStatus((current) => ({ ...current, [statusKey]: resultPayload.created ? "added" : "exists" }));
    } catch (error) {
      setPhraseActionStatus((current) => ({ ...current, [statusKey]: "error" }));
      setPhraseActionError((current) => ({
        ...current,
        [statusKey]: error instanceof Error && error.message ? error.message : t("newItem.sentenceAddError"),
      }));
    }
  };

  const regenerateRelatedDialogAudio = async (dialogId: number): Promise<void> => {
    if (regeneratingRelatedDialogId !== null) {
      return;
    }
    setRegeneratingRelatedDialogId(dialogId);
    setExerciseError("");
    try {
      const refreshedDialog = await regenerateContentDialogAudio(dialogId, sourceLanguage, targetLanguage);
      setRelatedDialogs((current) => current.map((dialog) => (
        dialog.dialog_id === dialogId
          ? {
              ...dialog,
              topic: refreshedDialog.topic,
              context: refreshedDialog.context,
              audio_url: refreshedDialog.audio_url,
              created_at: refreshedDialog.created_at,
              turn_count: refreshedDialog.turn_count,
              turns: refreshedDialog.turns,
            }
          : dialog
      )));
    } catch {
      setExerciseError(t("manage.error.regenerateAudio"));
    } finally {
      setRegeneratingRelatedDialogId(null);
    }
  };

  const loadCompareWordsSearch = async (page = 1, query = compareWordsQuery): Promise<void> => {
    if (item.item_type !== "word") {
      return;
    }
    setLoadingCompareWords(true);
    setCompareWordsError("");
    try {
      const payload = await searchContentItemCompareWords(item.id, query, page, 10, sourceLanguage, targetLanguage);
      setCompareWordsResults(payload.items || []);
      setCompareWordsPage(payload.page || page);
      setCompareWordsHasMore(Boolean(payload.has_more));
    } catch {
      setCompareWordsError(t("newItem.compareWordsLoadError"));
    } finally {
      setLoadingCompareWords(false);
    }
  };

  const openCompareWordsModal = (): void => {
    setShowCompareWordsModal(true);
    setSelectedCompareWordIds([]);
  };

  const toggleCompareWordSelection = (wordId: number): void => {
    setSelectedCompareWordIds((current) => (
      current.includes(wordId)
        ? current.filter((id) => id !== wordId)
        : [...current, wordId]
    ));
  };

  const saveCompareWords = async (): Promise<void> => {
    if (!selectedCompareWordIds.length || savingCompareWords) {
      return;
    }
    setSavingCompareWords(true);
    setCompareWordsError("");
    try {
      const payload = await addContentItemCompareWords(item.id, selectedCompareWordIds, sourceLanguage, targetLanguage);
      setCompareWords(payload.compare_words || []);
      setSelectedCompareWordIds([]);
      setShowCompareWordsModal(false);
    } catch {
      setCompareWordsError(t("newItem.compareWordsSaveError"));
    } finally {
      setSavingCompareWords(false);
    }
  };

  const removeCompareWord = async (linkedItemId: number): Promise<void> => {
    if (savingCompareWords) {
      return;
    }
    setSavingCompareWords(true);
    setCompareWordsError("");
    try {
      const payload = await removeContentItemCompareWord(item.id, linkedItemId, sourceLanguage, targetLanguage);
      setCompareWords(payload.compare_words || []);
      if (showCompareWordsModal) {
        void loadCompareWordsSearch(compareWordsPage, compareWordsQuery);
      }
    } catch {
      setCompareWordsError(t("newItem.compareWordsRemoveError"));
    } finally {
      setSavingCompareWords(false);
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
      const response = await askContentItemQuestion(item.id, questionText, itemQuestions, sourceLanguage, targetLanguage);
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

  const askPresetItemQuestion = async (questionText: string): Promise<void> => {
    const trimmed = questionText.trim();
    if (askingQuestion || !trimmed) {
      return;
    }
    setAskingQuestion(true);
    setItemQuestionError("");
    try {
      const response = await askContentItemQuestion(item.id, trimmed, itemQuestions, sourceLanguage, targetLanguage);
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

  const quickItemQuestions = [
    t("newItem.questionsQuickMeaning"),
    t("newItem.questionsQuickUse"),
    t("newItem.questionsQuickExamples"),
    t("newItem.questionsQuickMistakes"),
  ];

  const confirmAddWordFromDialog = async (): Promise<void> => {
    if (!pendingWordAdd || addingWord) {
      return;
    }

    const { key, source, target, dialogId, turnIndex, sourceLine, targetLine, clickedTargetToken } = pendingWordAdd;
    setWordActionStatus((current) => ({ ...current, [key]: "saving" }));
    setAddingWord(true);
    try {
      const result = await quickAddWordFromDialog(
        source,
        target,
        sourceLanguage,
        targetLanguage,
        dialogId,
        turnIndex,
        false,
        sourceLine,
        targetLine,
        clickedTargetToken,
      );
      setWordActionStatus((current) => ({ ...current, [key]: result.created ? "added" : "exists" }));
      if (result.id) {
        setLoadingLinkedWord(true);
        try {
          const detail = await fetchContentItemDetail(result.id, sourceLanguage, targetLanguage);
          setOpenedLinkedWord({
            id: detail.id,
            item_type: detail.item_type,
            spanish_text: detail.spanish_text,
            german_text: detail.german_text,
            example_sentence: detail.example_sentence || "",
            notes: detail.notes || "",
            word_type: detail.word_type || result.word_type || "",
            audio_url: detail.audio_url || result.audio_url || "",
            exercise_phrases: detail.exercise_phrases || {},
            mode: "new",
            direction: null,
            options: [],
            dialog_phrase_answer: detail.dialog_phrase_answer || "",
            dialog_phrase_scene: detail.dialog_phrase_scene || "",
            dialog_phrase_scene_audio_urls: detail.dialog_phrase_scene_audio_urls || [],
            dialog_phrase_options: detail.dialog_phrase_options || [],
            dialog_phrase_turns: detail.dialog_phrase_turns || [],
            dialog_phrase_odd_index: detail.dialog_phrase_odd_index ?? null,
            related_dialogs: detail.related_dialogs || [],
            compare_words: detail.compare_words || [],
            item_questions: detail.item_questions || [],
          });
        } finally {
          setLoadingLinkedWord(false);
        }
      }
    } catch {
      setWordActionStatus((current) => ({ ...current, [key]: "error" }));
    } finally {
      setAddingWord(false);
      setPendingWordAdd(null);
    }
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
  const funnyImageExerciseEntry = exercisePhrases?.funny_image_phrase;
  const funnyImageExerciseSelectionEntry = funnyImageExerciseEntry?.source_text && funnyImageExerciseEntry?.target_text
    ? {
        label: funnyImageExerciseEntry.label || "funny image",
        source: funnyImageExerciseEntry.source_text,
        target: funnyImageExerciseEntry.target_text,
      }
    : undefined;
  const regularWordExerciseEntries = item.item_type === "word"
    ? [
        {
          label: "word",
          source: sourceText,
          target: targetText,
        },
        ...generatedWordExerciseEntries,
      ]
    : generatedWordExerciseEntries;
  const wordExerciseEntries = item.item_type === "word"
    ? [
        ...regularWordExerciseEntries,
        ...(funnyImageExerciseSelectionEntry ? [funnyImageExerciseSelectionEntry] : []),
      ]
    : regularWordExerciseEntries;
  const isVerbWord = item.item_type === "word" && String(wordType || "").trim().toLowerCase() === "verb";
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

  const compareExerciseWords = item.item_type === "word"
    ? compareWords
    : [];
  const compareWordExerciseEntries = (
    word: NonNullable<SessionItem["compare_words"]>[number],
    exercisePhrasePayload?: SessionItem["exercise_phrases"],
  ): Array<{ source: string; target: string; label: string }> => {
    const wordLabel = word.german_text;
    const compareWordEntry = {
      label: wordLabel ? `${wordLabel} - word` : "word",
      source: word.spanish_text,
      target: word.german_text,
    };
    const compareSavedEntries = sanitizeExerciseEntries(exercisePhrasePayload?.phrases);
    const compareLegacyEntries = [
      ...sanitizeExerciseEntries(exercisePhrasePayload?.first_section),
      ...sanitizeExerciseEntries(exercisePhrasePayload?.second_section),
    ];
    const compareGeneratedEntries = compareSavedEntries.length ? compareSavedEntries : compareLegacyEntries;
    const compareFunnyImageEntry = exercisePhrasePayload?.funny_image_phrase;
    const compareFunnyImageSelectionEntry = compareFunnyImageEntry?.source_text && compareFunnyImageEntry?.target_text
      ? [{
          label: wordLabel ? `${wordLabel} - ${compareFunnyImageEntry.label || "funny image"}` : (compareFunnyImageEntry.label || "funny image"),
          source: compareFunnyImageEntry.source_text,
          target: compareFunnyImageEntry.target_text,
        }]
      : [];
    const labeledGeneratedEntries = compareGeneratedEntries.map((entry) => ({
      ...entry,
      label: wordLabel ? `${wordLabel} - ${entry.label}` : entry.label,
    }));
    return [compareWordEntry, ...labeledGeneratedEntries, ...compareFunnyImageSelectionEntry];
  };
  const compareExerciseEntries = item.item_type === "word"
    ? compareExerciseWords.flatMap((word) => compareWordExerciseEntries(word, word.exercise_phrases))
    : [];
  const allWordExerciseEntries = item.item_type === "word"
    ? [...wordExerciseEntries, ...compareExerciseEntries]
    : wordExerciseEntries;
  const selectedExerciseEntries = item.item_type === "phrase"
    ? [{ source: sourceText, target: targetText }]
    : allWordExerciseEntries.filter((entry) => selectedExerciseKeys.includes(exerciseEntryKey(entry)));
  const exerciseLines = selectedExerciseEntries.map((entry) => entry.target);
  const orderedItemQuestions = [...itemQuestions].sort((left, right) => left.id - right.id);
  const wordPracticeItemBase: SessionItem = {
    ...item,
    spanish_text: sourceText,
    german_text: targetText,
    audio_url: audioUrl,
    exercise_phrases: exercisePhrases,
    mode: "review",
    direction: "es_to_de",
    repeatedAfterFailure: true,
    options: [],
    related_dialogs: relatedDialogs,
  };
  const wordIntroPracticeItem: SessionItem = {
    ...wordPracticeItemBase,
    repeatPracticeStep: "word_intro",
  };
  const wordLetterPracticeItem: SessionItem = {
    ...wordPracticeItemBase,
    repeatPracticeStep: "word_cloze",
  };
  const phraseBuilderItem: SessionItem = {
    ...item,
    spanish_text: sourceText,
    german_text: targetText,
    mode: "review",
    direction: "es_to_de",
    repeatedAfterFailure: true,
    repeatPracticeStep: "phrase_builder",
    options: [],
    dialog_phrase_answer: dialogPhraseAnswer,
    dialog_phrase_scene: dialogPhraseScene,
    dialog_phrase_scene_audio_urls: dialogPhraseSceneAudioUrls,
    dialog_phrase_options: dialogPhraseOptions,
    dialog_phrase_turns: dialogPhraseTurns,
    dialog_phrase_odd_index: dialogPhraseOddIndex,
  };
  const directTestItem: SessionItem = {
    ...item,
    spanish_text: sourceText,
    german_text: targetText,
    audio_url: audioUrl,
    exercise_phrases: exercisePhrases,
    mode: "review",
    direction: "es_to_de",
    repeatedAfterFailure: false,
    repeatPracticeStep: undefined,
    options: [],
    related_dialogs: relatedDialogs,
    dialog_phrase_answer: dialogPhraseAnswer,
    dialog_phrase_scene: dialogPhraseScene,
    dialog_phrase_scene_audio_urls: dialogPhraseSceneAudioUrls,
    dialog_phrase_options: dialogPhraseOptions,
    dialog_phrase_turns: dialogPhraseTurns,
    dialog_phrase_odd_index: dialogPhraseOddIndex,
  };
  const itemDeterministicKey = `${item.item_type}:${sourceText.trim().toLowerCase()}=>${targetText.trim().toLowerCase()}`;

  const deterministicExerciseEntryKeys = (count: number): string[] => {
    const keys = allWordExerciseEntries.map(exerciseEntryKey);
    if (keys.length <= count) {
      return keys;
    }
    return deterministicTake(keys, count, `${itemDeterministicKey}:exercise-keys:${count}`, (key) => key);
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

  const selectDeterministicVerbExerciseGroup = (): void => {
    const groups = [
      ...VERB_PERSONS.map((person) => verbExerciseKeysForPerson(person.key)),
      ...VERB_TENSES.map((tense) => verbExerciseKeysForTense(tense.key)),
    ].filter((keys) => keys.length > 0);
    if (!groups.length) {
      setSelectedExerciseKeys([]);
      return;
    }
    const selectedGroupIndex = deterministicIndex(groups.length, `${itemDeterministicKey}:verb-group`);
    setSelectedExerciseKeys(groups[selectedGroupIndex]);
  };

  useEffect(() => {
    if (!showExerciseModal || item.item_type !== "word") {
      setSelectedExerciseKeys([]);
      return;
    }
    if (isVerbExerciseGrid) {
      selectDeterministicVerbExerciseGroup();
    } else {
      setSelectedExerciseKeys(deterministicExerciseEntryKeys(2));
    }
  }, [showExerciseModal, item.id, item.item_type, isVerbExerciseGrid, itemDeterministicKey, compareWords]);

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
      setSelectedExerciseKeys([
        ...verbExerciseGridEntries.map(({ entry }) => exerciseEntryKey(entry)),
        ...compareExerciseEntries.map(exerciseEntryKey),
      ]);
      return;
    }
    setSelectedExerciseKeys(allWordExerciseEntries.map(exerciseEntryKey));
  };

  const selectRandomExerciseEntries = (): void => {
    if (isVerbExerciseGrid) {
      selectDeterministicVerbExerciseGroup();
      return;
    }
    setSelectedExerciseKeys(deterministicExerciseEntryKeys(2));
  };

  const unselectAllExerciseEntries = (): void => {
    setSelectedExerciseKeys([]);
  };

  const compareWordNeedsExerciseGeneration = (word: NonNullable<SessionItem["compare_words"]>[number]): boolean => {
    return compareWordExerciseEntries(word, word.exercise_phrases).length <= 1;
  };

  const openExerciseModal = async (): Promise<void> => {
    if (showExerciseModal) {
      return;
    }
    setExerciseError("");
    if (item.item_type === "word") {
      let nextCompareWords = compareWords;
      setLoadingExercises(true);
      try {
        if (item.id > 0) {
          const detail = await fetchContentItemDetail(item.id, sourceLanguage, targetLanguage);
          nextCompareWords = detail.compare_words || [];
          setCompareWords(nextCompareWords);
        }
        const shouldGenerateCurrentWordExercises = item.id > 0
          && (
            generatedWordExerciseEntries.length === 0
            || (isVerbWord && (!hasVerbExerciseGridEntries || !hasCurrentVerbExerciseGeneration))
          );
        const missingCompareWords = nextCompareWords.filter((word) => word.id > 0 && compareWordNeedsExerciseGeneration(word));
        if (shouldGenerateCurrentWordExercises) {
          const payload = await generateContentItemExercises(item.id, sourceLanguage, targetLanguage);
          setExercisePhrases(payload.exercise_phrases || {});
        }
        if (missingCompareWords.length > 0) {
          const generatedCompareWords = await Promise.all(
            missingCompareWords.map(async (word) => {
              const payload = await generateContentItemExercises(word.id, sourceLanguage, targetLanguage);
              return {
                id: word.id,
                exercise_phrases: payload.exercise_phrases || {},
              };
            }),
          );
          const generatedCompareWordMap = new Map(
            generatedCompareWords.map((word) => [word.id, word.exercise_phrases]),
          );
          setCompareWords((current) => current.map((word) => (
            generatedCompareWordMap.has(word.id)
              ? { ...word, exercise_phrases: generatedCompareWordMap.get(word.id) || {} }
              : word
          )));
          nextCompareWords = nextCompareWords.map((word) => (
            generatedCompareWordMap.has(word.id)
              ? { ...word, exercise_phrases: generatedCompareWordMap.get(word.id) || {} }
              : word
          ));
        }
      } catch {
        setExerciseError(t("newItem.exercisesGenerationError"));
      } finally {
        setLoadingExercises(false);
      }
    }
    setShowExerciseModal(true);
  };

  const refreshWordData = async (): Promise<void> => {
    if (refreshingWord || item.item_type !== "word" || item.id <= 0) {
      return;
    }
    setRefreshingWord(true);
    setExerciseError("");
    setWordRefreshMessage("");
    try {
      const payload = await refreshContentItemWord(item.id, sourceLanguage, targetLanguage);
      setExercisePhrases(payload.exercise_phrases || {});
      setSourceText(payload.spanish_text || sourceText);
      setTargetText(payload.german_text || targetText);
      setWordType(payload.word_type || "");
      setRelatedDialogs(payload.related_dialogs || []);
      setWordRefreshMessage(t("newItem.wordRefreshComplete", { count: payload.dialog_occurrences_created || 0 }));
    } catch (error) {
      setExerciseError(error instanceof Error ? error.message : t("newItem.wordRefreshError"));
    } finally {
      setRefreshingWord(false);
    }
  };

  const regenerateAudio = async (): Promise<void> => {
    if (regeneratingAudio || refreshingWord || item.id <= 0) {
      return;
    }
    setRegeneratingAudio(true);
    setExerciseError("");
    setWordRefreshMessage("");
    try {
      const nextAudioUrl = await regenerateContentItemAudio(item.id, sourceLanguage, targetLanguage);
      if (nextAudioUrl) {
        setAudioUrl(nextAudioUrl);
      }
    } catch {
      setExerciseError(t("newItem.audioRegenerationError"));
    } finally {
      setRegeneratingAudio(false);
    }
  };

  const generateFunnyImageExercise = async (): Promise<void> => {
    if (generatingFunnyImageExercise || item.item_type !== "word" || item.id <= 0) {
      return;
    }
    setExerciseError("");
    setGeneratingFunnyImageExercise(true);
    try {
      const payload = await generateContentItemFunnyImageExercise(item.id, sourceLanguage, targetLanguage);
      setExercisePhrases(payload.exercise_phrases || {});
    } catch {
      setExerciseError(t("newItem.exercisesFunnyImageError"));
    } finally {
      setGeneratingFunnyImageExercise(false);
    }
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

  const pauseBetweenExercisePhrases = async (runId: number): Promise<void> => {
    if (exerciseRunRef.current !== runId || !exerciseRunningRef.current) {
      return;
    }
    await new Promise<void>((resolve) => window.setTimeout(resolve, EXERCISE_PHRASE_PAUSE_MS));
  };

  const playAudioSourcesOnce = async (sources: string[], runId: number): Promise<void> => {
    for (let index = 0; index < sources.length; index += 1) {
      const source = sources[index];
      if (!source || exerciseRunRef.current !== runId || !exerciseRunningRef.current) {
        continue;
      }
      if (exerciseMutedRef.current) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 250));
        continue;
      }
      await new Promise<void>((resolve) => {
        const audio = new Audio(source);
        exerciseAudioRef.current = audio;
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        audio.onpause = () => resolve();
        void audio.play().catch(() => resolve());
      });
    }
    exerciseAudioRef.current = null;
  };

  const speechLangByCode: Record<StudyLanguageCode, string> = {
    spanish: "es-ES",
    english: "en-US",
    german: "de-DE",
    french: "fr-FR",
    italian: "it-IT",
    portuguese: "pt-PT",
  };

  const playFunnyImageWordAudio = (): void => {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || !targetText.trim()) {
      return;
    }
    if (exerciseRunningRef.current) {
      stopExercise(false);
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(targetText);
    const lang = speechLangByCode[targetLanguage] || "de-DE";
    const langPrefix = lang.split("-")[0];
    utterance.lang = lang;
    utterance.rate = 0.65;

    const matchingVoices = window.speechSynthesis
      .getVoices()
      .filter((voice) => voice.lang.toLowerCase().startsWith(langPrefix.toLowerCase()));
    const selectedVoice = matchingVoices.length
      ? matchingVoices[deterministicIndex(matchingVoices.length, `${itemDeterministicKey}:funny-image-voice`)]
      : undefined;
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    } else {
      utterance.pitch = deterministicNumber(`${itemDeterministicKey}:funny-image-pitch`, 0.85, 1.2);
    }
    window.speechSynthesis.speak(utterance);
  };

  const speakLinesOnce = async (lines: string[], runId: number): Promise<void> => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }
    window.speechSynthesis.cancel();
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (exerciseRunRef.current !== runId || !exerciseRunningRef.current) {
        return;
      }
      if (exerciseMutedRef.current) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 250));
        continue;
      }
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
          if (exerciseRunRef.current !== runId || !exerciseRunningRef.current || exerciseMutedRef.current) {
            window.speechSynthesis.cancel();
            finish();
          }
        }, 50);
        utterance.lang = speechLangByCode[targetLanguage] || "de-DE";
        utterance.rate = 0.48;
        utterance.onend = finish;
        utterance.onerror = finish;
        window.speechSynthesis.speak(utterance);
      });
      if (index < lines.length - 1) {
        await pauseBetweenExercisePhrases(runId);
      }
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
          if (!exerciseMutedRef.current) {
            playExerciseDoneSound();
          }
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    const phraseExerciseAudioSources = item.item_type === "phrase" && audioUrl ? [audioUrl] : [];
    const playOnce = phraseExerciseAudioSources.length
      ? () => playAudioSourcesOnce(phraseExerciseAudioSources, runId)
      : () => speakLinesOnce(exerciseLines, runId);

    const loop = (): void => {
      if (exerciseRunRef.current !== runId || !exerciseRunningRef.current) {
        return;
      }
      void playOnce().then(async () => {
        if (exerciseRunRef.current !== runId || !exerciseRunningRef.current) {
          return;
        }
        await pauseBetweenExercisePhrases(runId);
        if (exerciseRunRef.current !== runId || !exerciseRunningRef.current) {
          return;
        }
        loop();
      });
    };
    loop();
  };

  const closeExerciseModal = (): void => {
    stopExercise();
    setShowFunnyImageModal(false);
    setShowExerciseModal(false);
  };

  const closeWordIntroPracticeModal = (): void => {
    setShowWordIntroPracticeModal(false);
  };

  const closeWordLetterPracticeModal = (): void => {
    setShowWordLetterPracticeModal(false);
  };

  const closePhraseBuilderModal = (): void => {
    setShowPhraseBuilderModal(false);
  };

  const openPrimaryTestModal = (): void => {
    setDirectTestReviewComplete(false);
    setDirectTestCorrect(null);
    setDirectTestResetVersion((value) => value + 1);
    setShowDirectTestModal(true);
  };

  const closeDirectTestModal = (): void => {
    setShowDirectTestModal(false);
    setDirectTestReviewComplete(false);
    setDirectTestCorrect(null);
  };

  const registerDirectTestAnswer = async (correct: boolean): Promise<void> => {
    if (directTestReviewComplete) {
      return;
    }
    await submitReview(item.id, correct, "es_to_de");
    setDirectTestCorrect(correct);
    setDirectTestReviewComplete(true);
  };

  const showItemActionTooltip = (
    event: PointerEvent<HTMLButtonElement> | FocusEvent<HTMLButtonElement>,
    label: string,
  ): void => {
    const rect = event.currentTarget.getBoundingClientRect();
    setItemActionTooltip({
      label,
      left: rect.left + rect.width / 2,
      top: rect.top - 8,
    });
  };

  const hideItemActionTooltip = (): void => {
    setItemActionTooltip(null);
  };

  return (
    <div>
      {readOnly && onClose && (
        <button type="button" className="modal-corner-close" aria-label={t("words.close")} onClick={onClose}>
          ×
        </button>
      )}
      <p className="prompt">{item.item_type === "word" ? t("newItem.word") : t("newItem.phrase")}</p>
      <p>
        <strong>{t("newItem.sourceLabel", { language: sourceLanguageLabel })}</strong> {sourceText}
      </p>
      <p>
        <strong>{t("newItem.targetLabel", { language: targetLanguageLabel })}</strong> {targetText}
      </p>
      {item.item_type === "word" && (
        <p>
          <strong>{t("newItem.wordTypeLabel")}</strong> {wordType || t("newItem.wordAddTypeUnknown")}
        </p>
      )}
      <p>
        <strong>{t("newItem.notes")}</strong> {item.notes || "-"}
      </p>
      {audioUrl && (
        <>
          <audio controls src={audioUrl}>
            {t("newItem.noAudioSupport")}
          </audio>
        </>
      )}
      {(item.item_type === "word" || item.item_type === "phrase") && (
        <div className="actions item-actions-toolbar">
          <div className="item-action-group item-action-group-primary" aria-label={t("newItem.actionGroupPractice")}>
            <button
              type="button"
              className="secondary-button item-action-button item-action-button-icon item-action-button-primary"
              onClick={() => void openExerciseModal()}
              disabled={loadingExercises}
              aria-label={t("newItem.openExercises")}
              title={t("newItem.openExercises")}
              onPointerEnter={(event) => showItemActionTooltip(event, t("newItem.openExercises"))}
              onPointerLeave={hideItemActionTooltip}
              onFocus={(event) => showItemActionTooltip(event, t("newItem.openExercises"))}
              onBlur={hideItemActionTooltip}
            >
              <ItemActionIcon name="exercise" />
            </button>
            <button
              type="button"
              className="secondary-button item-action-button item-action-button-icon item-action-button-primary"
              onClick={openPrimaryTestModal}
              disabled={loadingExercises}
              aria-label={t("newItem.openItemTest")}
              title={t("newItem.openItemTest")}
              onPointerEnter={(event) => showItemActionTooltip(event, t("newItem.openItemTest"))}
              onPointerLeave={hideItemActionTooltip}
              onFocus={(event) => showItemActionTooltip(event, t("newItem.openItemTest"))}
              onBlur={hideItemActionTooltip}
            >
              <ItemActionIcon name="test" />
            </button>
            {item.item_type === "word" && (
              <button
                type="button"
                className="secondary-button item-action-button item-action-button-icon item-action-button-primary"
                onClick={() => setShowWordIntroPracticeModal(true)}
                aria-label={t("newItem.openWordIntroPractice")}
                title={t("newItem.openWordIntroPractice")}
                onPointerEnter={(event) => showItemActionTooltip(event, t("newItem.openWordIntroPractice"))}
                onPointerLeave={hideItemActionTooltip}
                onFocus={(event) => showItemActionTooltip(event, t("newItem.openWordIntroPractice"))}
                onBlur={hideItemActionTooltip}
              >
                <ItemActionIcon name="warmup" />
              </button>
            )}
            {item.item_type === "word" && (
              <button
                type="button"
                className="secondary-button item-action-button item-action-button-icon item-action-button-primary"
                onClick={() => setShowWordLetterPracticeModal(true)}
                aria-label={t("newItem.openWordLetterPractice")}
                title={t("newItem.openWordLetterPractice")}
                onPointerEnter={(event) => showItemActionTooltip(event, t("newItem.openWordLetterPractice"))}
                onPointerLeave={hideItemActionTooltip}
                onFocus={(event) => showItemActionTooltip(event, t("newItem.openWordLetterPractice"))}
                onBlur={hideItemActionTooltip}
              >
                <ItemActionIcon name="letters" />
              </button>
            )}
            {item.item_type === "phrase" && (
              <button
                type="button"
                className="secondary-button item-action-button item-action-button-icon item-action-button-primary"
                onClick={() => setShowPhraseBuilderModal(true)}
                aria-label={t("newItem.openPhraseBuilder")}
                title={t("newItem.openPhraseBuilder")}
                onPointerEnter={(event) => showItemActionTooltip(event, t("newItem.openPhraseBuilder"))}
                onPointerLeave={hideItemActionTooltip}
                onFocus={(event) => showItemActionTooltip(event, t("newItem.openPhraseBuilder"))}
                onBlur={hideItemActionTooltip}
              >
                <ItemActionIcon name="builder" />
              </button>
            )}
          </div>
          <div className="item-action-group" aria-label={t("newItem.actionGroupExplore")}>
            <button
              type="button"
              className="secondary-button item-action-button item-action-button-icon"
              onClick={() => setShowDialogsModal(true)}
              aria-label={t("newItem.openRelatedDialogs")}
              title={t("newItem.openRelatedDialogs")}
              onPointerEnter={(event) => showItemActionTooltip(event, t("newItem.openRelatedDialogs"))}
              onPointerLeave={hideItemActionTooltip}
              onFocus={(event) => showItemActionTooltip(event, t("newItem.openRelatedDialogs"))}
              onBlur={hideItemActionTooltip}
            >
              <ItemActionIcon name="dialogs" />
            </button>
            <button
              type="button"
              className="secondary-button item-action-button item-action-button-icon"
              onClick={() => setShowQuestionsModal(true)}
              aria-label={t("newItem.openQuestions")}
              title={t("newItem.openQuestions")}
              onPointerEnter={(event) => showItemActionTooltip(event, t("newItem.openQuestions"))}
              onPointerLeave={hideItemActionTooltip}
              onFocus={(event) => showItemActionTooltip(event, t("newItem.openQuestions"))}
              onBlur={hideItemActionTooltip}
            >
              <ItemActionIcon name="questions" />
            </button>
          </div>
          <div className="item-action-group item-action-group-danger" aria-label={t("newItem.actionGroupDanger")}>
            <DangerousButton
              className="secondary-button item-action-button item-action-button-icon dangerous-action-button"
              onConfirm={regenerateAudio}
              disabled={regeneratingAudio || refreshingWord}
              aria-label={regeneratingAudio ? t("newItem.audioRegenerating") : t("newItem.regenerateAudio")}
              title={regeneratingAudio ? t("newItem.audioRegenerating") : t("newItem.regenerateAudio")}
              onPointerEnter={(event) => showItemActionTooltip(event, regeneratingAudio ? t("newItem.audioRegenerating") : t("newItem.regenerateAudio"))}
              onPointerLeave={hideItemActionTooltip}
              onFocus={(event) => showItemActionTooltip(event, regeneratingAudio ? t("newItem.audioRegenerating") : t("newItem.regenerateAudio"))}
              onBlur={hideItemActionTooltip}
            >
              <ItemActionIcon name="audio" />
            </DangerousButton>
            {item.item_type === "word" && (
              <DangerousButton
                className="secondary-button item-action-button item-action-button-icon dangerous-action-button"
                onConfirm={refreshWordData}
                disabled={refreshingWord || regeneratingAudio}
                aria-label={refreshingWord ? t("newItem.wordRefreshRunning") : t("newItem.wordRefresh")}
                title={refreshingWord ? t("newItem.wordRefreshRunning") : t("newItem.wordRefresh")}
                onPointerEnter={(event) => showItemActionTooltip(event, refreshingWord ? t("newItem.wordRefreshRunning") : t("newItem.wordRefresh"))}
                onPointerLeave={hideItemActionTooltip}
                onFocus={(event) => showItemActionTooltip(event, refreshingWord ? t("newItem.wordRefreshRunning") : t("newItem.wordRefresh"))}
                onBlur={hideItemActionTooltip}
              >
                <ItemActionIcon name="refresh" />
              </DangerousButton>
            )}
          </div>
        </div>
      )}
      {itemActionTooltip && (
        <div
          className="item-action-tooltip"
          role="tooltip"
          style={{
            left: itemActionTooltip.left,
            top: itemActionTooltip.top,
          }}
        >
          {itemActionTooltip.label}
        </div>
      )}
      {wordRefreshMessage && <p className="hint">{wordRefreshMessage}</p>}
      {exerciseError && !showExerciseModal && <p className="error">{exerciseError}</p>}
      {!readOnly && (
        <div className="actions">
          <button type="button" className="item-got-it-button" onClick={markAsSeen} disabled={saving}>
            {saving ? t("newItem.saving") : (continueLabel || t("newItem.gotIt"))}
          </button>
        </div>
      )}
      {showDialogsModal && (item.item_type === "word" || item.item_type === "phrase") && (
        <div className="blocking-modal-overlay" role="dialog" aria-modal="true">
          <div className="blocking-modal related-dialogs-modal">
            <button type="button" className="modal-corner-close" aria-label={t("newItem.closeRelatedDialogs")} onClick={() => setShowDialogsModal(false)}>
              ×
            </button>
            <p>
              <strong>{t("newItem.relatedDialogs", { count: relatedDialogs.length })}</strong>
            </p>
            {!relatedDialogs.length && <p>{t("newItem.noRelatedDialogs")}</p>}
            {!!relatedDialogs.length && (
              <div ref={relatedDialogsScrollRef} className="related-dialogs-scroll">
                {(showAllDialogs ? relatedDialogs : relatedDialogs.slice(0, 2)).map((dialog) => {
                const showDialogTargetText = targetPromptMode === "text" || Boolean(showDialogTargetTextById[dialog.dialog_id]);
                const hideDialogTargetText = targetPromptMode === "audio" && !showDialogTargetText;
                const matchedTurnIndexes = new Set(dialog.matched_turns.map((turn) => turn.turn_index));
                return (
                  <div
                    key={dialog.dialog_id}
                    ref={(element) => {
                      if (element) {
                        relatedDialogCardRefs.current.set(dialog.dialog_id, element);
                      } else {
                        relatedDialogCardRefs.current.delete(dialog.dialog_id);
                      }
                    }}
                    className="related-dialog-card"
                  >
                    <p>
                      <strong>{dialog.topic}</strong>
                    </p>
                    <p>
                      <strong>{t("newItem.dialogContext")}:</strong> {dialog.context || t("newItem.dialogNoContext")}
                    </p>
                    {!!dialog.turns.length && (
                      <>
                        <p><strong>{t("newItem.dialogTurns")}:</strong></p>
                        <div className="dialog-list-controls related-dialog-sticky-controls">
                          <div className="item-action-group" aria-label={t("newItem.actionGroupExplore")}>
                            <button
                              type="button"
                              className="secondary-button exercise-action-icon-button dialog-list-action-button"
                              onClick={() => {
                                if (playingRelatedDialogId === dialog.dialog_id) {
                                  stopRelatedDialogPlayback();
                                  return;
                                }
                                void playRelatedDialog(dialog);
                              }}
                              disabled={Boolean(loadingRelatedDialogAudioKey)}
                              aria-label={playingRelatedDialogId === dialog.dialog_id ? t("dialogs.stopDialog") : t("dialogs.playDialog")}
                              title={playingRelatedDialogId === dialog.dialog_id ? t("dialogs.stopDialog") : t("dialogs.playDialog")}
                              onPointerEnter={(event) => showItemActionTooltip(event, playingRelatedDialogId === dialog.dialog_id ? t("dialogs.stopDialog") : t("dialogs.playDialog"))}
                              onPointerLeave={hideItemActionTooltip}
                              onFocus={(event) => showItemActionTooltip(event, playingRelatedDialogId === dialog.dialog_id ? t("dialogs.stopDialog") : t("dialogs.playDialog"))}
                              onBlur={hideItemActionTooltip}
                            >
                              <DialogActionIcon name={playingRelatedDialogId === dialog.dialog_id ? "stop" : "play"} />
                            </button>
                            {targetPromptMode === "audio" && (
                              <button
                                type="button"
                                className="secondary-button exercise-action-icon-button dialog-list-action-button"
                                onClick={() => setShowDialogTargetTextById((current) => ({
                                  ...current,
                                  [dialog.dialog_id]: !current[dialog.dialog_id],
                                }))}
                                aria-label={showDialogTargetText ? t("prompt.hideText") : t("prompt.showText")}
                                title={showDialogTargetText ? t("prompt.hideText") : t("prompt.showText")}
                                aria-pressed={showDialogTargetText}
                                onPointerEnter={(event) => showItemActionTooltip(event, showDialogTargetText ? t("prompt.hideText") : t("prompt.showText"))}
                                onPointerLeave={hideItemActionTooltip}
                                onFocus={(event) => showItemActionTooltip(event, showDialogTargetText ? t("prompt.hideText") : t("prompt.showText"))}
                                onBlur={hideItemActionTooltip}
                              >
                                <DialogActionIcon name="text" />
                              </button>
                            )}
                            <button
                              type="button"
                              className="secondary-button exercise-action-icon-button dialog-list-action-button"
                              onClick={() => scrollToNextRelatedDialog(dialog.dialog_id)}
                              aria-label={t("newItem.nextDialog")}
                              title={t("newItem.nextDialog")}
                              onPointerEnter={(event) => showItemActionTooltip(event, t("newItem.nextDialog"))}
                              onPointerLeave={hideItemActionTooltip}
                              onFocus={(event) => showItemActionTooltip(event, t("newItem.nextDialog"))}
                              onBlur={hideItemActionTooltip}
                            >
                              <DialogActionIcon name="next" />
                            </button>
                          </div>
                          <div className="item-action-group item-action-group-danger" aria-label={t("newItem.actionGroupDanger")}>
                            <DangerousButton
                              type="button"
                              className="secondary-button exercise-action-icon-button dialog-list-action-button"
                              onConfirm={() => regenerateRelatedDialogAudio(dialog.dialog_id)}
                              disabled={regeneratingRelatedDialogId === dialog.dialog_id}
                              aria-label={regeneratingRelatedDialogId === dialog.dialog_id ? t("dialogs.loading") : t("manage.regenerateAudio")}
                              title={regeneratingRelatedDialogId === dialog.dialog_id ? t("dialogs.loading") : t("manage.regenerateAudio")}
                              onPointerEnter={(event) => showItemActionTooltip(event, regeneratingRelatedDialogId === dialog.dialog_id ? t("dialogs.loading") : t("manage.regenerateAudio"))}
                              onPointerLeave={hideItemActionTooltip}
                              onFocus={(event) => showItemActionTooltip(event, regeneratingRelatedDialogId === dialog.dialog_id ? t("dialogs.loading") : t("manage.regenerateAudio"))}
                              onBlur={hideItemActionTooltip}
                            >
                              <DialogActionIcon name="refresh" />
                            </DangerousButton>
                          </div>
                        </div>
                        <DialogTurnsList
                          dialogId={dialog.dialog_id}
                          turns={dialog.turns}
                          sourceLanguage={sourceLanguage}
                          targetLanguage={targetLanguage}
                          hideTargetText={hideDialogTargetText}
                          tokenStatus={wordActionStatus}
                          statusKeyPrefixBase="related"
                          onOpenItem={openLinkedDialogItem}
                          onTokenClick={(statusKey, token, turnIndex, sourceText, targetTextLine) => void requestAddWordFromDialogToken(
                            statusKey,
                            token,
                            token,
                            dialog.dialog_id,
                            turnIndex,
                            sourceText,
                            targetTextLine,
                          )}
                          highlightedTurnIndex={playingRelatedDialogTurn?.dialogId === dialog.dialog_id ? playingRelatedDialogTurn.turnIndex : null}
                          highlightedTurnIndexes={matchedTurnIndexes}
                          renderLeadingAction={(turn) => (
                            <button
                              type="button"
                              className="secondary-button exercise-action-icon-button dialog-inline-action-button"
                              disabled={!turn.phrase_audio_url || playingRelatedDialogId !== null}
                              onClick={() => void playTurnAudio(turn.phrase_audio_url || "")}
                              aria-label={t("newItem.playTurnAudio")}
                              title={t("newItem.playTurnAudio")}
                              onPointerEnter={(event) => showItemActionTooltip(event, t("newItem.playTurnAudio"))}
                              onPointerLeave={hideItemActionTooltip}
                              onFocus={(event) => showItemActionTooltip(event, t("newItem.playTurnAudio"))}
                              onBlur={hideItemActionTooltip}
                            >
                              <DialogActionIcon name="play" />
                            </button>
                          )}
                          renderTurnActions={(turn, index) => {
                            const phraseKey = wholeTurnPhraseKey(dialog.dialog_id, index);
                            return (
                              <>
                                <button
                                  type="button"
                                  className="secondary-button"
                                  onClick={() => void addWholeTurnPhraseFromRelatedDialog(dialog.dialog_id, turn, index)}
                                  disabled={phraseActionStatus[phraseKey] === "saving"}
                                >
                                  {phraseActionStatus[phraseKey] === "saving"
                                    ? t("newItem.sentenceAddSaving")
                                    : t("content.preview.savePhrase")}
                                </button>
                                {phraseActionStatus[phraseKey] === "added" && (
                                  <span className="turn-token-status">{t("newItem.sentenceAddAdded")}</span>
                                )}
                                {phraseActionStatus[phraseKey] === "exists" && (
                                  <span className="turn-token-status">{t("newItem.sentenceAddExists")}</span>
                                )}
                                {phraseActionStatus[phraseKey] === "error" && (
                                  <span className="turn-token-status">
                                    {phraseActionError[phraseKey] || t("newItem.sentenceAddError")}
                                  </span>
                                )}
                              </>
                            );
                          }}
                        />
                      </>
                    )}
                  </div>
                );
                })}
              </div>
            )}
            <div className="actions">
              {!!relatedDialogs.length && relatedDialogs.length > 2 && (
                <button type="button" onClick={() => setShowAllDialogs((value) => !value)}>
                  {showAllDialogs ? t("newItem.hideMoreDialogs") : t("newItem.showMoreDialogs")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {showWordIntroPracticeModal && item.item_type === "word" && (
        <div className="blocking-modal-overlay" role="dialog" aria-modal="true">
          <div className="blocking-modal related-dialogs-modal phrase-builder-modal">
            <button type="button" className="modal-corner-close" aria-label={t("newItem.closeRelatedDialogs")} onClick={closeWordIntroPracticeModal}>
              ×
            </button>
            <p>
              <strong>{t("newItem.wordIntroPracticeTitle")}</strong>
            </p>
            <WordReview
              key={`word-intro-practice-${item.id}-${sourceText}-${targetText}`}
              item={wordIntroPracticeItem}
              onAnswered={async () => closeWordIntroPracticeModal()}
            />
          </div>
        </div>
      )}
      {showCompareWordsModal && item.item_type === "word" && (
        <div className="blocking-modal-overlay" role="dialog" aria-modal="true">
          <div className="blocking-modal related-dialogs-modal compare-words-modal">
            <button type="button" className="modal-corner-close" aria-label={t("newItem.closeRelatedDialogs")} onClick={() => setShowCompareWordsModal(false)}>
              ×
            </button>
            <p>
              <strong>{t("newItem.compareWordsModalTitle")}</strong>
            </p>
            <div className="compare-words-search-row">
              <input
                value={compareWordsQuery}
                onChange={(event) => setCompareWordsQuery(event.target.value)}
                placeholder={t("newItem.compareWordsSearchPlaceholder")}
                disabled={savingCompareWords}
              />
            </div>
            {compareWordsError && <p className="error">{compareWordsError}</p>}
            {loadingCompareWords && <p className="hint">{t("session.loading")}</p>}
            {!loadingCompareWords && !compareWordsResults.length && (
              <p className="hint">{t("newItem.compareWordsSearchEmpty")}</p>
            )}
            {!!compareWordsResults.length && (
              <div className="compare-words-modal-list">
                {compareWordsResults.map((candidate) => {
                  const checked = selectedCompareWordIds.includes(candidate.id);
                  return (
                    <label key={candidate.id} className={`compare-word-select-row ${checked ? "compare-word-select-row-selected" : ""}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCompareWordSelection(candidate.id)}
                        disabled={savingCompareWords}
                      />
                      <span>
                        <strong>{candidate.german_text}</strong>
                        <small>{candidate.spanish_text}</small>
                        <em>{candidate.word_type || t("newItem.wordAddTypeUnknown")}</em>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
            <div className="actions compare-words-modal-actions">
              <button
                type="button"
                onClick={() => void saveCompareWords()}
                disabled={!selectedCompareWordIds.length || savingCompareWords}
              >
                {savingCompareWords ? t("newItem.wordAddSaving") : t("newItem.compareWordsConfirm")}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => void loadCompareWordsSearch(Math.max(1, compareWordsPage - 1), compareWordsQuery)}
                disabled={compareWordsPage <= 1 || loadingCompareWords || savingCompareWords}
              >
                {t("manage.previousPage")}
              </button>
              <span>{t("manage.pageLabel", { page: compareWordsPage })}</span>
              <button
                type="button"
                className="secondary-button"
                onClick={() => void loadCompareWordsSearch(compareWordsPage + 1, compareWordsQuery)}
                disabled={!compareWordsHasMore || loadingCompareWords || savingCompareWords}
              >
                {t("manage.nextPage")}
              </button>
            </div>
          </div>
        </div>
      )}
      {showDirectTestModal && (item.item_type === "word" || item.item_type === "phrase") && (
        <div className="blocking-modal-overlay" role="dialog" aria-modal="true">
          <div className="blocking-modal related-dialogs-modal phrase-builder-modal">
            <button type="button" className="modal-corner-close" aria-label={t("newItem.closeRelatedDialogs")} onClick={closeDirectTestModal}>
              ×
            </button>
            <p>
              <strong>{t("newItem.openItemTest")}</strong>
            </p>
            {item.item_type === "word" ? (
              <WordReview
                key={`direct-word-test-${item.id}-${sourceText}-${targetText}-${relatedDialogs.length}-${directTestResetVersion}`}
                item={directTestItem}
                onAnswered={registerDirectTestAnswer}
                reviewComplete={directTestReviewComplete}
                onNextItem={async () => closeDirectTestModal()}
              />
            ) : (
              <PhraseReview
                key={`direct-phrase-test-${item.id}-${sourceText}-${targetText}-${directTestResetVersion}`}
                item={directTestItem}
                onAnswered={registerDirectTestAnswer}
                reviewComplete={directTestReviewComplete}
                onNextItem={async () => closeDirectTestModal()}
              />
            )}
          </div>
        </div>
      )}
      {showWordLetterPracticeModal && item.item_type === "word" && (
        <div className="blocking-modal-overlay" role="dialog" aria-modal="true">
          <div className="blocking-modal related-dialogs-modal phrase-builder-modal">
            <button type="button" className="modal-corner-close" aria-label={t("newItem.closeRelatedDialogs")} onClick={closeWordLetterPracticeModal}>
              ×
            </button>
            <p>
              <strong>{t("newItem.wordLetterPracticeTitle")}</strong>
            </p>
            <WordReview
              key={`word-letter-practice-${item.id}-${sourceText}-${targetText}-${relatedDialogs.length}`}
              item={wordLetterPracticeItem}
              onAnswered={async () => closeWordLetterPracticeModal()}
            />
          </div>
        </div>
      )}
      {showPhraseBuilderModal && item.item_type === "phrase" && (
        <div className="blocking-modal-overlay" role="dialog" aria-modal="true">
          <div className="blocking-modal related-dialogs-modal phrase-builder-modal">
            <button type="button" className="modal-corner-close" aria-label={t("newItem.closeRelatedDialogs")} onClick={closePhraseBuilderModal}>
              ×
            </button>
            <p>
              <strong>{t("newItem.phraseBuilderTitle")}</strong>
            </p>
            <PhraseReview
              key={`phrase-builder-${item.id}-${sourceText}-${targetText}`}
              item={phraseBuilderItem}
              onAnswered={async () => closePhraseBuilderModal()}
            />
          </div>
        </div>
      )}
      {showExerciseModal && (item.item_type === "word" || item.item_type === "phrase") && (
        <div className="blocking-modal-overlay" role="dialog" aria-modal="true">
          <div className={`blocking-modal related-dialogs-modal exercise-modal ${isVerbExerciseGrid ? "verb-exercise-modal" : ""}`}>
            <button type="button" className="modal-corner-close" aria-label={t("newItem.closeRelatedDialogs")} onClick={closeExerciseModal}>
              ×
            </button>
            <p className="exercise-modal-header">
              <strong>{t("newItem.exercisesTitle")}</strong>
            </p>
            <p className="hint exercise-modal-description">{t("newItem.exercisesDescription")}</p>
            <div className="exercise-modal-scroll">
              {loadingExercises && <p className="hint">{t("newItem.exercisesGenerating")}</p>}
              {exerciseError && <p className="error">{exerciseError}</p>}
              {item.item_type === "word" && (
                <>
                  <div className="exercise-selection-actions">
                    <button
                      type="button"
                      className="secondary-button exercise-action-icon-button"
                      onClick={unselectAllExerciseEntries}
                      disabled={exerciseRunning || selectedExerciseKeys.length === 0}
                      aria-label={t("newItem.exercisesUnselectAll")}
                      title={t("newItem.exercisesUnselectAll")}
                    >
                      <ItemActionIcon name="clearAll" />
                    </button>
                    <button
                      type="button"
                      className="secondary-button exercise-action-icon-button"
                      onClick={selectAllExerciseEntries}
                      disabled={exerciseRunning || wordExerciseEntries.length === 0}
                      aria-label={t("newItem.exercisesSelectAll")}
                      title={t("newItem.exercisesSelectAll")}
                    >
                      <ItemActionIcon name="selectAll" />
                    </button>
                    <button
                      type="button"
                      className="secondary-button exercise-action-icon-button"
                      onClick={selectRandomExerciseEntries}
                      disabled={exerciseRunning || wordExerciseEntries.length === 0}
                      aria-label={t("newItem.exercisesRandomSelection")}
                      title={t("newItem.exercisesRandomSelection")}
                    >
                      <ItemActionIcon name="random" />
                    </button>
                    {funnyImageExerciseEntry?.image_url && funnyImageExerciseSelectionEntry && (
                      <button
                        type="button"
                        className="secondary-button exercise-action-icon-button"
                        onClick={() => setShowFunnyImageModal(true)}
                        aria-label={t("newItem.exercisesFunnyImageShow")}
                        title={t("newItem.exercisesFunnyImageShow")}
                      >
                        <ItemActionIcon name="openImage" />
                      </button>
                    )}
                    <div className="exercise-image-actions">
                      {funnyImageExerciseEntry ? (
                        <DangerousButton
                          className="secondary-button dangerous-action-button exercise-action-icon-button"
                          onConfirm={generateFunnyImageExercise}
                          disabled={generatingFunnyImageExercise || item.id <= 0}
                          aria-label={generatingFunnyImageExercise ? t("newItem.exercisesFunnyImageGenerating") : t("newItem.exercisesFunnyImageGenerate")}
                          title={generatingFunnyImageExercise ? t("newItem.exercisesFunnyImageGenerating") : t("newItem.exercisesFunnyImageGenerate")}
                        >
                          <ItemActionIcon name="image" />
                        </DangerousButton>
                      ) : (
                        <button
                          type="button"
                          className="secondary-button exercise-action-icon-button"
                          onClick={() => void generateFunnyImageExercise()}
                          disabled={generatingFunnyImageExercise || item.id <= 0}
                          aria-label={generatingFunnyImageExercise ? t("newItem.exercisesFunnyImageGenerating") : t("newItem.exercisesFunnyImageGenerate")}
                          title={generatingFunnyImageExercise ? t("newItem.exercisesFunnyImageGenerating") : t("newItem.exercisesFunnyImageGenerate")}
                        >
                          <ItemActionIcon name="image" />
                        </button>
                      )}
                    </div>
                  </div>
                  {generatingFunnyImageExercise && (
                    <p className="hint">{t("newItem.exercisesFunnyImagePending")}</p>
                  )}
                  {funnyImageExerciseEntry?.image_url && funnyImageExerciseSelectionEntry && (
                    <div className="funny-image-phrase-row">
                      <label className={`exercise-phrase-row ${selectedExerciseKeys.includes(exerciseEntryKey(funnyImageExerciseSelectionEntry)) ? "exercise-phrase-row-selected" : ""}`}>
                        <input
                          type="checkbox"
                          checked={selectedExerciseKeys.includes(exerciseEntryKey(funnyImageExerciseSelectionEntry))}
                          onChange={() => toggleExerciseEntry(funnyImageExerciseSelectionEntry)}
                          disabled={exerciseRunning}
                        />
                        <span>
                          <strong>{funnyImageExerciseSelectionEntry.target}</strong>
                          <small>{funnyImageExerciseSelectionEntry.source}</small>
                          <em className="exercise-phrase-label">{funnyImageExerciseSelectionEntry.label}</em>
                        </span>
                      </label>
                    </div>
                  )}
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
                  {!!compareExerciseEntries.length && (
                    <div className="compare-exercise-section">
                      <p className="compare-exercise-title">
                        <strong>{t("newItem.compareExerciseTitle")}</strong>
                      </p>
                      <div className="compare-exercise-list">
                        {compareExerciseEntries.map((entry) => {
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
                      <li>{targetText}</li>
                    </ul>
                    <div className="exercise-translation-group">
                      {sourceLanguageLabel}: {sourceText}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="exercise-modal-footer">
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
                {exerciseRunning && (
                  <button
                    type="button"
                    className="secondary-button exercise-mute-button"
                    aria-pressed={exerciseMuted}
                    onClick={() => setExerciseMuted((value) => !value)}
                  >
                    {exerciseMuted ? t("newItem.exercisesUnmute") : t("newItem.exercisesMute")}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {showFunnyImageModal && funnyImageExerciseEntry?.image_url && funnyImageExerciseSelectionEntry && (
        <div className="blocking-modal-overlay" role="dialog" aria-modal="true">
          <div className="blocking-modal funny-image-modal">
            <button
              type="button"
              className="modal-corner-close"
              aria-label={t("newItem.closeRelatedDialogs")}
              onClick={() => setShowFunnyImageModal(false)}
            >
              ×
            </button>
            <button
              type="button"
              className="funny-image-large-button"
              onClick={playFunnyImageWordAudio}
              aria-label={t("newItem.exercisesFunnyImagePlayWord")}
            >
              <img src={funnyImageExerciseEntry.image_url} alt={funnyImageExerciseSelectionEntry.target} />
            </button>
          </div>
        </div>
      )}
      {showQuestionsModal && (item.item_type === "word" || item.item_type === "phrase") && (
        <div className="blocking-modal-overlay" role="dialog" aria-modal="true">
          <div className="blocking-modal related-dialogs-modal questions-modal">
            <button type="button" className="modal-corner-close" aria-label={t("newItem.closeRelatedDialogs")} onClick={() => setShowQuestionsModal(false)}>
              ×
            </button>
            <p>
              <strong>{t("newItem.questionsTitle")}</strong>
            </p>
            <div className="questions-modal-item-texts">
              <p className="questions-modal-item-text">
                <strong>{t("newItem.sourceLabel", { language: sourceLanguageLabel })}</strong> {sourceText}
              </p>
              <p className="questions-modal-item-text">
                <strong>{t("newItem.targetLabel", { language: targetLanguageLabel })}</strong> {targetText}
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
            <div className="item-question-presets">
              {quickItemQuestions.map((question) => (
                <button
                  key={question}
                  type="button"
                  className="secondary-button item-question-preset"
                  disabled={askingQuestion}
                  onClick={() => void askPresetItemQuestion(question)}
                >
                  {question}
                </button>
              ))}
            </div>
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
          </div>
        </div>
      )}
      {item.item_type === "word" && (
        <section className="compare-words-section">
          <div className="compare-words-header">
            <p className="compare-words-title">
              <strong>{t("newItem.compareWordsTitle")}</strong>
            </p>
            <button type="button" className="secondary-button" onClick={openCompareWordsModal}>
              {t("newItem.compareWordsAdd")}
            </button>
          </div>
          {!compareWords.length && (
            <p className="hint compare-words-empty">{t("newItem.compareWordsEmpty")}</p>
          )}
          {!!compareWords.length && (
            <div className="compare-words-list">
              {compareWords.map((linkedWord) => (
                <div key={linkedWord.id} className="compare-word-row">
                  <div className="compare-word-text">
                    <strong>{linkedWord.german_text}</strong>
                    <span>{linkedWord.spanish_text}</span>
                    <small>{linkedWord.word_type || t("newItem.wordAddTypeUnknown")}</small>
                  </div>
                  <div className="compare-word-actions">
                    <button type="button" className="secondary-button" onClick={() => void openLinkedDialogItem(linkedWord.id)}>
                      {t("words.openItem")}
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => void removeCompareWord(linkedWord.id)}
                      disabled={savingCompareWords}
                    >
                      {t("newItem.compareWordsRemove")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {compareWordsError && !showCompareWordsModal && <p className="error">{compareWordsError}</p>}
        </section>
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
            <p className="add-word-modal-type">
              <strong>{t("newItem.wordAddType", { type: pendingWordAdd.wordType })}</strong>
            </p>
            {pendingWordAdd.note && (
              <p className="hint">{t("newItem.wordAddNote", { note: pendingWordAdd.note })}</p>
            )}
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
