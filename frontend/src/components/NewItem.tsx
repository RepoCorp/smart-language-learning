import { useEffect, useRef, useState, type FocusEvent, type PointerEvent } from "react";

import {
  askContentItemQuestion,
  fetchContentItemDetail,
  generateContentDialogTurnAudio,
  generateContentItemFunnyImageExercise,
  quickAddPhraseFromConversation,
  quickAddWordFromDialog,
  regenerateContentItem,
  regenerateContentDialogAudio,
  refreshContentItemWord,
  submitReview,
} from "../api";
import { generateContentItemExercises, generateContentItemNounExerciseCase } from "../apiNounExercises";
import { selectBestSpeechSynthesisVoice } from "../browserSpeech";
import { deterministicIndex, deterministicTake } from "../deterministic";
import { useI18n } from "../i18n";
import { usePromptPreferences } from "../promptPreferences";
import {
  STUDY_LANGUAGE_MESSAGE_KEY_BY_CODE,
  STUDY_LANGUAGE_SPEECH_LOCALE_BY_CODE,
} from "../studyLanguageMetadata";
import { useStudyLanguages } from "../studyLanguages";
import type { SessionItem } from "../types";
import DangerousButton from "./DangerousButton";
import CompareWordsModal from "./CompareWordsModal";
import DialogActionIcon from "./DialogActionIcon";
import DialogTurnsList from "./DialogTurnsList";
import ItemActionToolbar from "./ItemActionToolbar";
import ItemQuestionsModal from "./ItemQuestionsModal";
import PhraseReview from "./PhraseReview";
import FormsStrategyPanel from "./strategies/FormsStrategyPanel";
import ItemStrategiesModal from "./strategies/ItemStrategiesModal";
import { ACT_STRATEGY, CONNECT_STRATEGY, DECODE_STRATEGY, DEFAULT_STRATEGY, PERSONALIZE_STRATEGY, PRACTICE_STRATEGY, VISUALIZE_STRATEGY, WALK_STRATEGY } from "./strategies/strategyConstants";
import { useActStrategy } from "./strategies/useActStrategy";
import { useConnectStrategy } from "./strategies/useConnectStrategy";
import { useDecodeStrategy } from "./strategies/useDecodeStrategy";
import { useNounExerciseModal } from "./useNounExerciseModal";
import { usePersonalizeStrategy } from "./strategies/usePersonalizeStrategy";
import { usePracticeStrategy } from "./strategies/usePracticeStrategy";
import { useVisualizeStrategy } from "./strategies/useVisualizeStrategy";
import { useWalkStrategy } from "./strategies/useWalkStrategy";
import useRelatedDialogsFocus from "./useRelatedDialogsFocus";
import VerbExerciseSelector, {
  buildVerbExerciseGridEntries,
  getVerbExerciseKeysForPerson,
  getVerbExerciseKeysForTense,
  VERB_BY_TENSE_GENERATION_MODE,
  VERB_PERSONS,
  VERB_TENSES,
  type VerbPersonKey,
  type VerbTenseKey,
} from "./VerbExerciseSelector";
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
const EXERCISE_PHRASE_PAUSE_MS = 250;
function ItemActionIcon({ name }: {
  name: "selectAll" | "clearAll" | "random" | "image" | "openImage" | "refresh";
}): JSX.Element {
  const commonProps = {
    className: "item-action-icon",
    viewBox: "0 0 24 24",
    "aria-hidden": true,
  };

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

export default function NewItem({
  item,
  onContinue,
  continueLabel,
  autoplayAudioOnMount = false,
  readOnly = false,
  onClose,
}: NewItemProps): JSX.Element {
  const { t } = useI18n();
  const { targetPromptMode, showMobileActionLabels, preferredBrowserVoiceURIByLanguage } = usePromptPreferences();
  const { sourceLanguage, targetLanguage } = useStudyLanguages();
  const sourceLanguageLabel = t(STUDY_LANGUAGE_MESSAGE_KEY_BY_CODE[sourceLanguage]);
  const targetLanguageLabel = t(STUDY_LANGUAGE_MESSAGE_KEY_BY_CODE[targetLanguage]);
  const preferredBrowserVoiceURI = preferredBrowserVoiceURIByLanguage[targetLanguage] || "";
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
  const [generatingNounCaseKey, setGeneratingNounCaseKey] = useState<"" | "nominative" | "accusative" | "dative">("");
  const [refreshingWord, setRefreshingWord] = useState<boolean>(false);
  const [regeneratingAudio, setRegeneratingAudio] = useState<boolean>(false);
  const [generatingFunnyImageExercise, setGeneratingFunnyImageExercise] = useState<boolean>(false);
  const [exerciseError, setExerciseError] = useState<string>("");
  const [selectedStrategy, setSelectedStrategy] = useState<string>(DEFAULT_STRATEGY);
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
  const [notes, setNotes] = useState<string>(item.notes || "");
  const [pluralGerman, setPluralGerman] = useState<string>(item.plural_german || "");
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
  const [compareWordsInsights, setCompareWordsInsights] = useState<string>(item.compare_words_insights || "");
  const [showCompareWordsModal, setShowCompareWordsModal] = useState<boolean>(false);
  const [playingRelatedDialogId, setPlayingRelatedDialogId] = useState<number | null>(null);
  const [playingRelatedDialogTurn, setPlayingRelatedDialogTurn] = useState<{ dialogId: number; turnIndex: number } | null>(null);
  const [loadingRelatedDialogAudioKey, setLoadingRelatedDialogAudioKey] = useState<string>("");
  const [itemQuestionError, setItemQuestionError] = useState<string>("");
  const [askingQuestion, setAskingQuestion] = useState<boolean>(false);
  const [showDialogTargetTextById, setShowDialogTargetTextById] = useState<Record<number, boolean>>({});
  const exerciseTimerRef = useRef<number | null>(null);
  const exerciseRunRef = useRef<number>(0);
  const exerciseRunningRef = useRef<boolean>(false);
  const exerciseMutedRef = useRef<boolean>(false);
  const exerciseAudioRef = useRef<HTMLAudioElement | null>(null);
  const relatedDialogPlaybackRunRef = useRef<number>(0);
  const relatedDialogAudioRef = useRef<HTMLAudioElement | null>(null);
  const autoplayedAudioKeyRef = useRef<string>("");
  const {
    registerRelatedDialogCardRef,
    scrollToNextRelatedDialog,
  } = useRelatedDialogsFocus({
    showDialogsModal,
    relatedDialogs,
    showAllDialogs,
    playingRelatedDialogId,
    playingRelatedDialogTurn,
  });

  useEffect(() => {
    setExercisePhrases(item.exercise_phrases || {});
    setExerciseError("");
    setSelectedStrategy(DEFAULT_STRATEGY);
    setWordRefreshMessage("");
    setSourceText(item.spanish_text || "");
    setTargetText(item.german_text || "");
    setNotes(item.notes || "");
    setPluralGerman(item.plural_german || "");
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
    setCompareWordsInsights(item.compare_words_insights || "");
  }, [item.id, item.spanish_text, item.german_text, item.notes, item.plural_german, item.audio_url, item.exercise_phrases, item.word_type, item.dialog_phrase_answer, item.dialog_phrase_scene, item.dialog_phrase_scene_audio_urls, item.dialog_phrase_options, item.dialog_phrase_turns, item.dialog_phrase_odd_index, item.related_dialogs, item.compare_words, item.compare_words_insights]);

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
    setAskingQuestion(false);
    setShowQuestionsModal(false);
    setShowWordIntroPracticeModal(false);
    setShowWordLetterPracticeModal(false);
    setShowPhraseBuilderModal(false);
    setShowCompareWordsModal(false);
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
            plural_german: detail.plural_german || "",
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
            compare_words_insights: detail.compare_words_insights || "",
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
        plural_german: detail.plural_german || "",
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
        compare_words_insights: detail.compare_words_insights || "",
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

  const openCompareWordsModal = (): void => {
    setShowCompareWordsModal(true);
  };

  const askItemQuestion = async (questionText: string): Promise<void> => {
    if (askingQuestion || !questionText) {
      return;
    }
    setAskingQuestion(true);
    setItemQuestionError("");
    try {
      const response = await askContentItemQuestion(item.id, questionText, itemQuestions, sourceLanguage, targetLanguage);
      setItemQuestions(response.conversation || []);
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
            plural_german: detail.plural_german || "",
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
            compare_words_insights: detail.compare_words_insights || "",
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
  const personalizeStrategy = usePersonalizeStrategy({
    itemId: item.id,
    itemType: item.item_type,
    exercisePhrases,
    sourceLanguage,
    targetLanguage,
    setExercisePhrases,
    errorMessage: t("newItem.personalizeError"),
  });
  const practiceStrategy = usePracticeStrategy({
    itemId: item.id,
    itemType: item.item_type,
    exercisePhrases,
    sourceLanguage,
    targetLanguage,
    setExercisePhrases,
    errorMessage: t("newItem.practiceError"),
    enabled: showExerciseModal && selectedStrategy === PRACTICE_STRATEGY,
  });
  const connectStrategy = useConnectStrategy({
    itemId: item.id,
    itemType: item.item_type,
    exercisePhrases,
    sourceLanguage,
    targetLanguage,
    setExercisePhrases,
    errorMessage: t("newItem.connectError"),
    enabled: showExerciseModal && selectedStrategy === CONNECT_STRATEGY,
  });
  const visualizeStrategy = useVisualizeStrategy({
    itemId: item.id,
    itemType: item.item_type,
    exercisePhrases,
    sourceLanguage,
    targetLanguage,
    setExercisePhrases,
    errorMessage: t("newItem.visualizeError"),
    enabled: showExerciseModal && selectedStrategy === VISUALIZE_STRATEGY,
  });
  const actStrategy = useActStrategy({
    itemId: item.id,
    itemType: item.item_type,
    exercisePhrases,
    sourceLanguage,
    targetLanguage,
    setExercisePhrases,
    errorMessage: t("newItem.actError"),
    enabled: showExerciseModal && selectedStrategy === ACT_STRATEGY,
  });
  const walkStrategy = useWalkStrategy({
    itemId: item.id,
    itemType: item.item_type,
    exercisePhrases,
    sourceLanguage,
    targetLanguage,
    setExercisePhrases,
    errorMessage: t("newItem.walkError"),
    enabled: showExerciseModal && selectedStrategy === WALK_STRATEGY,
  });
  const decodeStrategy = useDecodeStrategy({
    itemId: item.id,
    itemType: item.item_type,
    exercisePhrases,
    sourceLanguage,
    targetLanguage,
    setExercisePhrases,
    errorMessage: t("newItem.decodeError"),
    enabled: showExerciseModal && selectedStrategy === DECODE_STRATEGY,
  });
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
  const {
    nounExerciseSections,
    isNounSectionedExercise,
  } = useNounExerciseModal({
    itemType: item.item_type,
    wordType,
    exercisePhrases,
  });
  const verbExerciseGridEntries = buildVerbExerciseGridEntries(generatedWordExerciseEntries);
  const hasVerbExerciseGridEntries = verbExerciseGridEntries.length > 0;
  const hasCurrentVerbExerciseGeneration = exercisePhrases?.generation_mode === VERB_BY_TENSE_GENERATION_MODE;
  const isVerbExerciseGrid = item.item_type === "word"
    && (isVerbWord || hasVerbExerciseGridEntries);
  const wordOnlyExerciseEntry = item.item_type === "word"
    ? wordExerciseEntries.find((entry) => entry.label === "word")
    : undefined;

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
  const selectedRepeatExerciseEntries = item.item_type === "phrase"
    ? [{ source: sourceText, target: targetText }]
    : allWordExerciseEntries.filter((entry) => selectedExerciseKeys.includes(exerciseEntryKey(entry)));
  const selectedPersonalizeEntries = personalizeStrategy.entries.filter((entry) => personalizeStrategy.selectedKeys.includes(exerciseEntryKey(entry)));
  const selectedPracticeEntries = practiceStrategy.entries.filter((entry) => practiceStrategy.selectedKeys.includes(exerciseEntryKey(entry)));
  const selectedConnectEntries = connectStrategy.allEntries
    .filter((entry) => connectStrategy.selectedKeys.includes(entry.key))
    .map((entry) => ({
      label: "connect",
      source: entry.exampleSource,
      target: entry.exampleTarget,
    }));
  const selectedVisualizeEntries = visualizeStrategy.entry && visualizeStrategy.selectedKeys.includes(visualizeStrategy.entry.key)
    ? [visualizeStrategy.entry]
    : [];
  const selectedActEntries = actStrategy.entry && actStrategy.selectedKeys.includes(actStrategy.entry.key)
    ? [actStrategy.entry]
    : [];
  const selectedWalkEntries = walkStrategy.entries.filter((entry) => walkStrategy.selectedKeys.includes(exerciseEntryKey(entry)));
  const selectedDecodeEntries = decodeStrategy.analysis.related
    .filter((entry) => decodeStrategy.selectedKeys.includes(entry.key))
    .map((entry) => ({
      label: "decode",
      source: entry.exampleSource,
      target: entry.exampleTarget,
    }));
  const selectedStrategyEntries = selectedStrategy === PERSONALIZE_STRATEGY
    ? selectedPersonalizeEntries
    : selectedStrategy === PRACTICE_STRATEGY
      ? selectedPracticeEntries
      : selectedStrategy === CONNECT_STRATEGY
        ? selectedConnectEntries
        : selectedStrategy === VISUALIZE_STRATEGY
          ? selectedVisualizeEntries
          : selectedStrategy === ACT_STRATEGY
            ? selectedActEntries
            : selectedStrategy === WALK_STRATEGY
              ? selectedWalkEntries
              : selectedStrategy === DECODE_STRATEGY
                ? selectedDecodeEntries
          : selectedRepeatExerciseEntries;
  const selectedExerciseEntries = selectedStrategyEntries;
  const exerciseLines = selectedExerciseEntries.map((entry) => entry.target);
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

  const initialExerciseEntryKeys = (): string[] => {
    if (wordOnlyExerciseEntry) {
      return [exerciseEntryKey(wordOnlyExerciseEntry)];
    }
    const firstEntry = allWordExerciseEntries[0];
    return firstEntry ? [exerciseEntryKey(firstEntry)] : [];
  };

  const verbExerciseKeysForPerson = (person: VerbPersonKey): string[] => getVerbExerciseKeysForPerson(
    verbExerciseGridEntries,
    exerciseEntryKey,
    person,
  );

  const verbExerciseKeysForTense = (tense: VerbTenseKey): string[] => getVerbExerciseKeysForTense(
    verbExerciseGridEntries,
    exerciseEntryKey,
    tense,
  );

  const selectVerbExercisePerson = (person: VerbPersonKey): void => {
    if ((person as string) === "__clear__") {
      setSelectedExerciseKeys([]);
      return;
    }
    setSelectedExerciseKeys(verbExerciseKeysForPerson(person));
  };

  const selectVerbExerciseTense = (tense: VerbTenseKey): void => {
    if ((tense as string) === "__clear__") {
      setSelectedExerciseKeys([]);
      return;
    }
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
      setSelectedExerciseKeys(initialExerciseEntryKeys());
    }
  }, [showExerciseModal, item.id, item.item_type, isVerbExerciseGrid, itemDeterministicKey, compareWords]);

  useEffect(() => {
    if (!showExerciseModal) {
      setSelectedStrategy(DEFAULT_STRATEGY);
      return;
    }
    if (item.item_type !== "word" && selectedStrategy === PERSONALIZE_STRATEGY) {
      setSelectedStrategy(DEFAULT_STRATEGY);
    }
  }, [showExerciseModal, item.item_type, selectedStrategy]);

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
          setCompareWordsInsights(detail.compare_words_insights || "");
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
        }
      } catch {
        setExerciseError(t("newItem.exercisesGenerationError"));
      } finally {
        setLoadingExercises(false);
      }
    }
    setShowExerciseModal(true);
  };

  const generateNounExerciseCase = async (caseKey: "nominative" | "accusative" | "dative"): Promise<void> => {
    if (generatingNounCaseKey || item.id <= 0) {
      return;
    }
    setExerciseError("");
    setGeneratingNounCaseKey(caseKey);
    try {
      const payload = await generateContentItemNounExerciseCase(item.id, caseKey, sourceLanguage, targetLanguage);
      setExercisePhrases(payload.exercise_phrases || {});
    } catch (error) {
      setExerciseError(error instanceof Error ? error.message : t("newItem.wordRefreshError"));
    } finally {
      setGeneratingNounCaseKey("");
    }
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
      setRelatedDialogs(payload.related_dialogs || []);
      setWordRefreshMessage(t("newItem.wordRefreshComplete", { count: payload.dialog_occurrences_created || 0 }));
    } catch (error) {
      setExerciseError(error instanceof Error ? error.message : t("newItem.wordRefreshError"));
    } finally {
      setRefreshingWord(false);
    }
  };

  const regenerateItemData = async (): Promise<void> => {
    if (regeneratingAudio || refreshingWord || item.id <= 0) {
      return;
    }
    setRegeneratingAudio(true);
    setExerciseError("");
    setWordRefreshMessage("");
    try {
      await regenerateContentItem(item.id, sourceLanguage, targetLanguage);
      const detail = await fetchContentItemDetail(item.id, sourceLanguage, targetLanguage);
      setSourceText(detail.spanish_text || "");
      setTargetText(detail.german_text || "");
      setNotes(detail.notes || "");
      setPluralGerman(detail.plural_german || "");
      setAudioUrl(detail.audio_url || "");
      setWordType(detail.word_type || "");
      setExercisePhrases(detail.exercise_phrases || {});
      setDialogPhraseAnswer(detail.dialog_phrase_answer || "");
      setDialogPhraseScene(detail.dialog_phrase_scene || "");
      setDialogPhraseSceneAudioUrls(detail.dialog_phrase_scene_audio_urls || []);
      setDialogPhraseOptions(detail.dialog_phrase_options || []);
      setDialogPhraseTurns(detail.dialog_phrase_turns || []);
      setDialogPhraseOddIndex(detail.dialog_phrase_odd_index ?? null);
      setRelatedDialogs(detail.related_dialogs || []);
      setCompareWords(detail.compare_words || []);
      setCompareWordsInsights(detail.compare_words_insights || "");
      setItemQuestions(detail.item_questions || []);
      setSelectedExerciseKeys([]);
    } catch (error) {
      setExerciseError(error instanceof Error ? error.message : t("newItem.itemRegenerationError"));
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

  const regenerateWordExercises = async (): Promise<void> => {
    if (loadingExercises || item.item_type !== "word" || item.id <= 0) {
      return;
    }
    setLoadingExercises(true);
    setExerciseError("");
    try {
      const payload = await generateContentItemExercises(item.id, sourceLanguage, targetLanguage);
      setExercisePhrases(payload.exercise_phrases || {});
      setSelectedExerciseKeys([]);
    } catch {
      setExerciseError(t("newItem.exercisesGenerationError"));
    } finally {
      setLoadingExercises(false);
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

  const playFunnyImageWordAudio = (): void => {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || !targetText.trim()) {
      return;
    }
    if (exerciseRunningRef.current) {
      stopExercise(false);
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(targetText);
    const lang = STUDY_LANGUAGE_SPEECH_LOCALE_BY_CODE[targetLanguage] || "de-DE";
    const langPrefix = lang.split("-")[0];
    utterance.lang = lang;
    utterance.rate = 0.95;

    const matchingVoices = window.speechSynthesis
      .getVoices()
      .filter((voice) => voice.lang.toLowerCase().startsWith(langPrefix.toLowerCase()));
    const selectedVoice = selectBestSpeechSynthesisVoice(matchingVoices, lang, preferredBrowserVoiceURI);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
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
        const lang = STUDY_LANGUAGE_SPEECH_LOCALE_BY_CODE[targetLanguage] || "de-DE";
        utterance.lang = lang;
        utterance.rate = 0.8;
        const selectedVoice = selectBestSpeechSynthesisVoice(window.speechSynthesis.getVoices(), lang, preferredBrowserVoiceURI);
        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }
        utterance.onend = finish;
        utterance.onerror = finish;
        window.speechSynthesis.speak(utterance);
      });
      if (index < lines.length - 1) {
        await pauseBetweenExercisePhrases(runId);
      }
    }
  };

  const startExercise = (overrideLines?: string[]): void => {
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
    const linesToPlay = overrideLines && overrideLines.length > 0 ? overrideLines : exerciseLines;
    const playOnce = phraseExerciseAudioSources.length
      ? () => playAudioSourcesOnce(phraseExerciseAudioSources, runId)
      : () => speakLinesOnce(linesToPlay, runId);

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

  const startFunnyImagePhraseExercise = (): void => {
    if (!funnyImageExerciseSelectionEntry) {
      return;
    }
    setSelectedExerciseKeys([exerciseEntryKey(funnyImageExerciseSelectionEntry)]);
    startExercise([funnyImageExerciseSelectionEntry.target]);
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
    <div className="item-view-shell">
      {readOnly && onClose && (
        <button type="button" className="modal-corner-close" aria-label={t("words.close")} onClick={onClose}>
          ×
        </button>
      )}
      <section className="item-view-header-card">
        <p className="item-view-kicker">{item.item_type === "word" ? t("newItem.word") : t("newItem.phrase")}</p>
        <div className="item-view-title-row">
          <div className="item-view-title-block">
            <h2 className="item-view-title">{targetText || sourceText}</h2>
            <p className="item-view-subtitle">{sourceText}</p>
          </div>
        </div>
        <div className="item-view-meta-grid">
          {item.item_type === "word" && (
            <div className="item-view-meta-card">
              <span className="item-view-meta-label">{t("newItem.wordTypeLabel")}</span>
              <strong className="item-view-meta-value">{wordType || t("newItem.wordAddTypeUnknown")}</strong>
            </div>
          )}
          <div className="item-view-meta-card">
            <span className="item-view-meta-label">{t("newItem.notes")}</span>
            <strong className="item-view-meta-value item-view-meta-value-notes">{item.notes || "-"}</strong>
          </div>
        </div>
      </section>
      {audioUrl && (
        <div className="item-view-audio-wrap">
          <audio controls src={audioUrl}>
            {t("newItem.noAudioSupport")}
          </audio>
        </div>
      )}
      {(item.item_type === "word" || item.item_type === "phrase") && (
        <ItemActionToolbar
          itemType={item.item_type}
          loadingExercises={loadingExercises}
          regeneratingAudio={regeneratingAudio}
          refreshingWord={refreshingWord}
          showMobileActionLabels={showMobileActionLabels}
          hasQuestions={itemQuestions.length > 0}
          hasCompareWordsContent={compareWords.length > 0 || Boolean(compareWordsInsights.trim())}
          onOpenExercises={() => {
            void openExerciseModal();
          }}
          onOpenTest={openPrimaryTestModal}
          onOpenWordIntroPractice={() => setShowWordIntroPracticeModal(true)}
          onOpenWordLetterPractice={() => setShowWordLetterPracticeModal(true)}
          onOpenPhraseBuilder={() => setShowPhraseBuilderModal(true)}
          onOpenRelatedDialogs={() => setShowDialogsModal(true)}
          onOpenQuestions={() => setShowQuestionsModal(true)}
          onOpenCompareWords={openCompareWordsModal}
          onRegenerateItem={regenerateItemData}
          onRefreshWordData={refreshWordData}
          onShowTooltip={showItemActionTooltip}
          onHideTooltip={hideItemActionTooltip}
        />
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
              <div className="related-dialogs-scroll">
                {(showAllDialogs ? relatedDialogs : relatedDialogs.slice(0, 2)).map((dialog) => {
                const showDialogTargetText = targetPromptMode === "text" || Boolean(showDialogTargetTextById[dialog.dialog_id]);
                const hideDialogTargetText = targetPromptMode === "audio" && !showDialogTargetText;
                const matchedTurnIndexes = new Set(dialog.matched_turns.map((turn) => turn.turn_index));
                return (
                  <div
                    key={dialog.dialog_id}
                    ref={(element) => registerRelatedDialogCardRef(dialog.dialog_id, element)}
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
                              onClick={() => scrollToNextRelatedDialog(
                                (showAllDialogs ? relatedDialogs : relatedDialogs.slice(0, 2)).map((entry) => entry.dialog_id),
                                dialog.dialog_id,
                              )}
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
        <CompareWordsModal
          open={showCompareWordsModal}
          itemId={item.id}
          compareWords={compareWords}
          initialInsights={compareWordsInsights}
          sourceLanguage={sourceLanguage}
          targetLanguage={targetLanguage}
          onClose={() => setShowCompareWordsModal(false)}
          onCompareWordsChange={setCompareWords}
          onInsightsChange={setCompareWordsInsights}
          onOpenItem={openLinkedDialogItem}
        />
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
        <ItemStrategiesModal
          itemType={item.item_type}
          sourceText={sourceText}
          targetText={targetText}
          pluralText={pluralGerman}
          selectedStrategy={selectedStrategy}
          onSelectedStrategyChange={setSelectedStrategy}
          onClose={closeExerciseModal}
          exerciseSecondsLeft={exerciseSecondsLeft}
          exerciseRunning={exerciseRunning}
          exerciseMuted={exerciseMuted}
          canStart={exerciseLines.length > 0}
          onStart={startExercise}
          onStop={stopExercise}
          onToggleMute={() => setExerciseMuted((value) => !value)}
          formsContent={(
            <FormsStrategyPanel
              itemType={item.item_type}
              targetText={targetText}
              sourceText={sourceText}
              sourceLanguageLabel={sourceLanguageLabel}
              loadingExercises={loadingExercises}
              exerciseError={exerciseError}
              exerciseRunning={exerciseRunning}
              generatingFunnyImageExercise={generatingFunnyImageExercise}
              wordExerciseEntries={wordExerciseEntries}
              selectedExerciseKeys={selectedExerciseKeys}
              funnyImageExerciseSelectionEntry={funnyImageExerciseSelectionEntry}
              funnyImageExerciseImageUrl={funnyImageExerciseEntry?.image_url}
              isVerbExerciseGrid={isVerbExerciseGrid}
              isNounSectionedExercise={isNounSectionedExercise}
              pluralGerman={pluralGerman}
              notes={notes}
              wordOnlyExerciseEntry={wordOnlyExerciseEntry}
              verbExerciseGridEntries={verbExerciseGridEntries}
              nounExerciseSections={nounExerciseSections}
              generatingNounCaseKey={generatingNounCaseKey}
              compareExerciseEntries={compareExerciseEntries}
              onToggleEntry={toggleExerciseEntry}
              onSelectPerson={selectVerbExercisePerson}
              onSelectTense={selectVerbExerciseTense}
              onSelectKeys={setSelectedExerciseKeys}
              onGenerateCase={(caseKey) => {
                void generateNounExerciseCase(caseKey);
              }}
              onOpenFunnyImage={() => setShowFunnyImageModal(true)}
              onGenerateFunnyImage={() => {
                void generateFunnyImageExercise();
              }}
              openImageIcon={<ItemActionIcon name="openImage" />}
              imageIcon={<ItemActionIcon name="image" />}
              exerciseEntryKey={exerciseEntryKey}
            />
          )}
          canRegenerateContent={
            item.item_type === "word"
            && item.id > 0
            && (
              selectedStrategy === DEFAULT_STRATEGY
              || selectedStrategy === PRACTICE_STRATEGY
              || selectedStrategy === CONNECT_STRATEGY
              || selectedStrategy === VISUALIZE_STRATEGY
              || selectedStrategy === ACT_STRATEGY
              || selectedStrategy === WALK_STRATEGY
              || selectedStrategy === DECODE_STRATEGY
            )
          }
          regeneratingContent={
            selectedStrategy === PRACTICE_STRATEGY
              ? practiceStrategy.isLoading
              : selectedStrategy === CONNECT_STRATEGY
                ? connectStrategy.isLoading
                : selectedStrategy === VISUALIZE_STRATEGY
                  ? visualizeStrategy.isLoading
                  : selectedStrategy === ACT_STRATEGY
                    ? actStrategy.isLoading
                    : selectedStrategy === WALK_STRATEGY
                      ? walkStrategy.isLoading
                      : selectedStrategy === DECODE_STRATEGY
                        ? decodeStrategy.isLoading
                  : loadingExercises
          }
          onRegenerateContent={() => {
            if (selectedStrategy === PRACTICE_STRATEGY) {
              void practiceStrategy.generate();
              return;
            }
            if (selectedStrategy === CONNECT_STRATEGY) {
              void connectStrategy.generate();
              return;
            }
            if (selectedStrategy === VISUALIZE_STRATEGY) {
              void visualizeStrategy.generate();
              return;
            }
            if (selectedStrategy === ACT_STRATEGY) {
              void actStrategy.generate();
              return;
            }
            if (selectedStrategy === WALK_STRATEGY) {
              void walkStrategy.generate();
              return;
            }
            if (selectedStrategy === DECODE_STRATEGY) {
              void decodeStrategy.generate();
              return;
            }
            void regenerateWordExercises();
          }}
          formsSelection={{
            canSelectEntries: wordExerciseEntries.length > 0 || compareExerciseEntries.length > 0 || item.item_type === "phrase",
            hasSelectedEntries: selectedExerciseKeys.length > 0 || item.item_type === "phrase",
            unselectAll: unselectAllExerciseEntries,
            selectAll: selectAllExerciseEntries,
            selectRandom: selectRandomExerciseEntries,
          }}
          personalizeStrategy={{
            inputValue: personalizeStrategy.inputValue,
            setInputValue: personalizeStrategy.setInputValue,
            generatePhrase: personalizeStrategy.generatePhrase,
            isGenerating: personalizeStrategy.isGenerating,
            error: personalizeStrategy.error,
            entries: personalizeStrategy.entries.map((entry) => ({ ...entry, key: exerciseEntryKey(entry) })),
            selectedKeys: personalizeStrategy.selectedKeys,
            toggleEntry: personalizeStrategy.toggleEntry,
            unselectAll: personalizeStrategy.unselectAll,
            selectAll: personalizeStrategy.selectAll,
            selectRandom: personalizeStrategy.selectRandom,
          }}
          practiceStrategy={{
            entries: practiceStrategy.entries.map((entry) => ({ ...entry, key: exerciseEntryKey(entry) })),
            selectedKeys: practiceStrategy.selectedKeys,
            toggleEntry: practiceStrategy.toggleEntry,
            isLoading: practiceStrategy.isLoading,
            error: practiceStrategy.error,
            unselectAll: practiceStrategy.unselectAll,
            selectAll: practiceStrategy.selectAll,
            selectRandom: practiceStrategy.selectRandom,
          }}
          connectStrategy={connectStrategy}
          visualizeStrategy={visualizeStrategy}
          actStrategy={actStrategy}
          walkStrategy={{
            entries: walkStrategy.entries.map((entry) => ({ ...entry, key: exerciseEntryKey(entry) })),
            selectedKeys: walkStrategy.selectedKeys,
            toggleEntry: walkStrategy.toggleEntry,
            isLoading: walkStrategy.isLoading,
            error: walkStrategy.error,
            unselectAll: walkStrategy.unselectAll,
            selectAll: walkStrategy.selectAll,
            selectRandom: walkStrategy.selectRandom,
          }}
          decodeStrategy={decodeStrategy}
        />
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
            <div className="actions">
              <button type="button" onClick={startFunnyImagePhraseExercise}>
                {t("newItem.exercisesStart")}
              </button>
            </div>
          </div>
        </div>
      )}
      {(item.item_type === "word" || item.item_type === "phrase") && (
        <ItemQuestionsModal
          open={showQuestionsModal}
          askingQuestion={askingQuestion}
          errorMessage={itemQuestionError}
          itemQuestions={itemQuestions}
          sourceLanguageLabel={sourceLanguageLabel}
          sourceText={sourceText}
          targetLanguageLabel={targetLanguageLabel}
          targetText={targetText}
          onClose={() => setShowQuestionsModal(false)}
          onAskQuestion={askItemQuestion}
        />
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
