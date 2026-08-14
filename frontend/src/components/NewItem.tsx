import {
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type PointerEvent,
} from "react";

import {
  fetchContentItemDetail,
  generateContentItemFunnyImageExercise,
  regenerateContentDialogAudio,
  submitReview,
} from "../api";
import {
  generateContentItemExercises,
  generateContentItemNounExerciseCase,
} from "../apiNounExercises";
import { deterministicIndex, deterministicTake } from "../deterministic";
import {
  playBrowserExerciseWord,
} from "../exerciseBrowserSpeech";
import { useI18n } from "../i18n";
import { usePromptPreferences } from "../promptPreferences";
import { STUDY_LANGUAGE_MESSAGE_KEY_BY_CODE } from "../studyLanguageMetadata";
import { useStudyLanguages } from "../studyLanguages";
import type { SessionItem } from "../types";
import { FullScreenLoadingOverlay } from "./BlockingLoadingOverlay";
import DangerousButton from "./DangerousButton";
import CompareWordsModal from "./CompareWordsModal";
import DialogActionIcon from "./DialogActionIcon";
import ItemActionToolbar from "./ItemActionToolbar";
import ItemAdminActionsModal from "./ItemAdminActionsModal";
import ItemQuestionsModal from "./ItemQuestionsModal";
import PhraseReview from "./PhraseReview";
import WordExerciseActions from "./WordExerciseActions";
import WordPartsReview from "./WordPartsReview";
import FormsStrategyPanel from "./strategies/FormsStrategyPanel";
import ItemStrategiesModal from "./strategies/ItemStrategiesModal";
import ItemTestingModal from "./testing/ItemTestingModal";
import { buildGermanPluralExerciseEntry } from "./wordExercisePrimaryEntry";
import {
  ACT_STRATEGY,
  COMPARE_STRATEGY,
  DECODE_STRATEGY,
  DEFAULT_STRATEGY,
  ENCOUNTER_STRATEGY,
  CREATE_STRATEGY,
  EXAMPLES_STRATEGY,
  RELATED_STRATEGY,
  VISUALIZE_STRATEGY,
  WALK_STRATEGY,
  firstStrategyForItemType,
} from "./strategies/strategyConstants";
import { useNounExerciseModal } from "./useNounExerciseModal";
import { useItemQuestions } from "./useItemQuestions";
import { useRepeatExerciseLoop } from "./useRepeatExerciseLoop";
import { useItemStrategies } from "./strategies/useItemStrategies";
import { useItemAdminActions } from "./useItemAdminActions";
import useRelatedDialogsFocus from "./useRelatedDialogsFocus";
import DialogTurnAudioModeButton from "./dialogs/DialogTurnAudioModeButton";
import RelatedDialogTurns from "./dialogs/RelatedDialogTurns";
import DialogItemSavingModals from "./dialogs/DialogItemSavingModals";
import { useDialogItemSaving } from "./dialogs/useDialogItemSaving";
import useRelatedDialogPlayback from "./dialogs/useRelatedDialogPlayback";
import type { DialogTurnAudioMode } from "./dialogs/useDialogTurnPlayback";
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

function ItemActionIcon({
  name,
}: {
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
  const {
    targetPromptMode,
    showMobileActionLabels,
    preferredBrowserVoiceURIByLanguage,
  } = usePromptPreferences();
  const { sourceLanguage, targetLanguage } = useStudyLanguages();
  const sourceLanguageLabel = t(
    STUDY_LANGUAGE_MESSAGE_KEY_BY_CODE[sourceLanguage],
  );
  const targetLanguageLabel = t(
    STUDY_LANGUAGE_MESSAGE_KEY_BY_CODE[targetLanguage],
  );
  const preferredBrowserVoiceURI =
    preferredBrowserVoiceURIByLanguage[targetLanguage] || "";
  const [saving, setSaving] = useState<boolean>(false);
  const [showAllDialogs, setShowAllDialogs] = useState<boolean>(false);
  const [showDialogsModal, setShowDialogsModal] = useState<boolean>(false);
  const [showExerciseModal, setShowExerciseModal] = useState<boolean>(false);
  const [showTestingModal, setShowTestingModal] = useState<boolean>(false);
  const [showDirectTestModal, setShowDirectTestModal] =
    useState<boolean>(false);
  const [directTestReviewComplete, setDirectTestReviewComplete] =
    useState<boolean>(false);
  const [directTestCorrect, setDirectTestCorrect] = useState<boolean | null>(
    null,
  );
  const [directTestResetVersion, setDirectTestResetVersion] =
    useState<number>(0);
  const [showWordIntroPracticeModal, setShowWordIntroPracticeModal] =
    useState<boolean>(false);
  const [showWordLetterPracticeModal, setShowWordLetterPracticeModal] =
    useState<boolean>(false);
  const [showPhraseBuilderModal, setShowPhraseBuilderModal] =
    useState<boolean>(false);
  const [showFunnyImageModal, setShowFunnyImageModal] =
    useState<boolean>(false);
  const [itemActionTooltip, setItemActionTooltip] = useState<{
    label: string;
    left: number;
    top: number;
  } | null>(null);
  const [loadingExercises, setLoadingExercises] = useState<boolean>(false);
  const [
    suppressInitialStrategyAutogeneration,
    setSuppressInitialStrategyAutogeneration,
  ] = useState<boolean>(false);
  const [initialModalStrategy, setInitialModalStrategy] = useState<string>(() =>
    firstStrategyForItemType(item.item_type),
  );
  const [generatingNounCaseKey, setGeneratingNounCaseKey] = useState<
    "" | "nominative" | "accusative" | "dative" | "genitive"
  >("");
  const [generatingFunnyImageExercise, setGeneratingFunnyImageExercise] =
    useState<boolean>(false);
  const [exerciseError, setExerciseError] = useState<string>("");
  const [selectedStrategy, setSelectedStrategy] = useState<string>(() =>
    firstStrategyForItemType(item.item_type),
  );
  const [selectedTestingAction, setSelectedTestingAction] =
    useState<string>("test");
  const [wordRefreshMessage, setWordRefreshMessage] = useState<string>("");
  const [selectedExerciseKeys, setSelectedExerciseKeys] = useState<string[]>(
    [],
  );
  const {
    wordActionStatus,
    phraseActionStatus,
    phraseActionError,
    pendingWordAdd,
    addingWord,
    openedLinkedWord,
    isSaving: savingDialogItem,
    setPendingWordAdd,
    setOpenedLinkedWord,
    openLinkedWordItem: openLinkedDialogItem,
    requestAddWordFromDialogToken,
    confirmAddWordFromDialog,
    addWholeTurnPhraseFromDialog: addWholeTurnPhraseFromRelatedDialog,
    wholeTurnPhraseKey,
  } = useDialogItemSaving({
    sourceLanguage,
    targetLanguage,
    phraseKeyPrefix: "related",
  });
  const [regeneratingRelatedDialogId, setRegeneratingRelatedDialogId] =
    useState<number | null>(null);
  const [exercisePhrases, setExercisePhrases] = useState(
    item.exercise_phrases || {},
  );
  const [sourceText, setSourceText] = useState<string>(item.spanish_text || "");
  const [targetText, setTargetText] = useState<string>(item.german_text || "");
  const [notes, setNotes] = useState<string>(item.notes || "");
  const [pluralGerman, setPluralGerman] = useState<string>(
    item.plural_german || "",
  );
  const [audioUrl, setAudioUrl] = useState<string>(item.audio_url || "");
  const [wordType, setWordType] = useState<string>(item.word_type || "");
  const [dialogPhraseAnswer, setDialogPhraseAnswer] = useState<string>(
    item.dialog_phrase_answer || "",
  );
  const [dialogPhraseScene, setDialogPhraseScene] = useState<string>(
    item.dialog_phrase_scene || "",
  );
  const [dialogPhraseSceneAudioUrls, setDialogPhraseSceneAudioUrls] = useState<
    string[]
  >(item.dialog_phrase_scene_audio_urls || []);
  const [dialogPhraseOptions, setDialogPhraseOptions] = useState<string[]>(
    item.dialog_phrase_options || [],
  );
  const [dialogPhraseTurns, setDialogPhraseTurns] = useState<
    NonNullable<SessionItem["dialog_phrase_turns"]>
  >(item.dialog_phrase_turns || []);
  const [dialogPhraseOddIndex, setDialogPhraseOddIndex] = useState<
    number | null
  >(item.dialog_phrase_odd_index ?? null);
  const [relatedDialogs, setRelatedDialogs] = useState<
    NonNullable<SessionItem["related_dialogs"]>
  >(item.related_dialogs || []);
  const [compareWords, setCompareWords] = useState<
    NonNullable<SessionItem["compare_words"]>
  >(item.compare_words || []);
  const [compareWordsInsights, setCompareWordsInsights] = useState<string>(
    item.compare_words_insights || "",
  );
  const [showCompareWordsModal, setShowCompareWordsModal] =
    useState<boolean>(false);
  const [relatedDialogTurnAudioMode, setRelatedDialogTurnAudioMode] =
    useState<DialogTurnAudioMode>("natural");
  const {
    showQuestionsModal,
    prefilledQuestion,
    prefilledGrammarFeatureKey,
    itemQuestions,
    itemQuestionError,
    askingQuestion,
    openQuestions,
    closeQuestions,
    resetQuestions,
    replaceItemQuestions,
    askItemQuestion,
  } = useItemQuestions({
    itemId: item.id,
    initialQuestions: item.item_questions || [],
    sourceLanguage,
    targetLanguage,
    refreshRelatedDialogHistory: showDialogsModal,
    questionError: t("newItem.questionsError"),
  });
  const applyRegeneratedItemDetail = (detail: Awaited<ReturnType<typeof fetchContentItemDetail>>): void => {
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
    replaceItemQuestions(detail.item_questions || []);
    setSelectedExerciseKeys([]);
  };
  const itemAdminActions = useItemAdminActions({
    itemId: item.id,
    itemType: item.item_type,
    initialIsLearned: Boolean(item.is_learned),
    sourceLanguage,
    targetLanguage,
    onItemRegenerated: applyRegeneratedItemDetail,
    onDialogsRescanned: (dialogs, createdCount) => {
      setRelatedDialogs(dialogs);
      setWordRefreshMessage(t("newItem.wordRefreshComplete", { count: createdCount }));
    },
    onAudioRegenerated: (nextAudioUrl) => setAudioUrl(nextAudioUrl || audioUrl),
    onDeleted: () => onClose?.(),
  });
  const [showDialogTargetTextById, setShowDialogTargetTextById] = useState<
    Record<number, boolean>
  >({});
  const autoplayedAudioKeyRef = useRef<string>("");
  const {
    loadingAudioKey: loadingRelatedDialogAudioKey,
    playingDialogId: playingRelatedDialogId,
    playingTurn: playingRelatedDialogTurn,
    playDialog: playRelatedDialog,
    playTurn: playRelatedDialogTurn,
    stopPlayback: stopRelatedDialogPlayback,
  } = useRelatedDialogPlayback({
    setDialogs: setRelatedDialogs,
    sourceLanguage,
    targetLanguage,
    onError: () => setExerciseError(t("dialogs.error.load")),
  });
  const { registerRelatedDialogCardRef, scrollToNextRelatedDialog } =
    useRelatedDialogsFocus({
      showDialogsModal,
      relatedDialogs,
      showAllDialogs,
      playingRelatedDialogId,
      playingRelatedDialogTurn,
    });

  useEffect(() => {
    setExercisePhrases(item.exercise_phrases || {});
    setExerciseError("");
    setSelectedStrategy(firstStrategyForItemType(item.item_type));
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
  }, [
    item.id,
    item.spanish_text,
    item.german_text,
    item.notes,
    item.plural_german,
    item.audio_url,
    item.exercise_phrases,
    item.word_type,
    item.dialog_phrase_answer,
    item.dialog_phrase_scene,
    item.dialog_phrase_scene_audio_urls,
    item.dialog_phrase_options,
    item.dialog_phrase_turns,
    item.dialog_phrase_odd_index,
    item.related_dialogs,
    item.compare_words,
    item.compare_words_insights,
  ]);

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
        showQuestionsModal ||
        showDialogsModal ||
        showCompareWordsModal ||
        showExerciseModal ||
        showTestingModal ||
        showDirectTestModal ||
        showWordIntroPracticeModal ||
        showWordLetterPracticeModal ||
        showPhraseBuilderModal
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
  }, [
    saving,
    onContinue,
    readOnly,
    showQuestionsModal,
    showDialogsModal,
    showCompareWordsModal,
    showExerciseModal,
    showTestingModal,
    showDirectTestModal,
    showWordIntroPracticeModal,
    showWordLetterPracticeModal,
    showPhraseBuilderModal,
  ]);

  useEffect(() => {
    resetQuestions();
    setShowWordIntroPracticeModal(false);
    setShowWordLetterPracticeModal(false);
    setShowPhraseBuilderModal(false);
    setShowCompareWordsModal(false);
  }, [item.id, item.item_questions]);

  useEffect(() => {
    setShowDialogTargetTextById({});
  }, [targetPromptMode]);

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
    if (
      withoutArticle &&
      withoutArticle.toLowerCase() !== normalized.toLowerCase()
    ) {
      candidates.push(withoutArticle);
    }
    return candidates.sort((a, b) => b.length - a.length);
  };

  const containsWordInTurn = (
    turnTargetText: string,
    word: string,
  ): boolean => {
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
  const speakerForTurn = (
    speaker: string | undefined,
    index: number,
  ): "a" | "b" =>
    speaker === "a" || speaker === "b" ? speaker : index % 2 === 0 ? "a" : "b";

  useEffect(() => {
    if (!showDialogsModal) {
      stopRelatedDialogPlayback();
    }
  }, [showDialogsModal]);

  const playAudioUrl = (audioUrl?: string): void => {
    if (!audioUrl) {
      return;
    }
    const audio = new Audio(audioUrl);
    void audio.play().catch(() => undefined);
  };

  const regenerateRelatedDialogAudio = async (
    dialogId: number,
  ): Promise<void> => {
    if (regeneratingRelatedDialogId !== null) {
      return;
    }
    setRegeneratingRelatedDialogId(dialogId);
    setExerciseError("");
    try {
      const refreshedDialog = await regenerateContentDialogAudio(
        dialogId,
        sourceLanguage,
        targetLanguage,
      );
      setRelatedDialogs((current) =>
        current.map((dialog) =>
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
            : dialog,
        ),
      );
    } catch {
      setExerciseError(t("manage.error.regenerateAudio"));
    } finally {
      setRegeneratingRelatedDialogId(null);
    }
  };

  const openCompareWordsModal = (): void => {
    setShowCompareWordsModal(true);
  };

  const sanitizeExerciseEntries = (
    entries?: Array<{
      label?: string;
      source_text?: string;
      target_text?: string;
    }>,
  ): Array<{ label: string; source: string; target: string }> => {
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

  const exerciseEntryKey = (entry: {
    label?: string;
    source: string;
    target: string;
  }): string => `${entry.label || ""}|||${entry.source}|||${entry.target}`;
  const {
    createStrategy,
    examplesStrategy,
    relatedStrategy,
    visualizeStrategy,
    actStrategy,
    walkStrategy,
    decodeStrategy,
    encounterStrategy,
    compareStrategy,
    grammarStrategy,
    phraseGrammarStrategy,
  } = useItemStrategies({
    itemId: item.id,
    itemType: item.item_type,
    exercisePhrases,
    sourceLanguage,
    targetLanguage,
    wordType,
    setExercisePhrases,
    modalOpen: showExerciseModal,
    selectedStrategy,
    initialStrategy: initialModalStrategy,
    suppressInitialAutogeneration: suppressInitialStrategyAutogeneration,
    errors: {
      create: t("newItem.createError"),
      examples: t("newItem.examplesError"),
      related: t("newItem.relatedError"),
      visualize: t("newItem.visualizeError"),
      act: t("newItem.actError"),
      walk: t("newItem.walkError"),
      decode: t("newItem.decodeError"),
      encounter: t("newItem.encounterError"),
      compare: t("newItem.compareError"),
    },
  });
  const savedExerciseEntries = sanitizeExerciseEntries(
    exercisePhrases?.phrases,
  );
  const legacyExerciseEntries = [
    ...sanitizeExerciseEntries(exercisePhrases?.first_section),
    ...sanitizeExerciseEntries(exercisePhrases?.second_section),
  ];
  const generatedWordExerciseEntries = savedExerciseEntries.length
    ? savedExerciseEntries
    : legacyExerciseEntries;
  const funnyImageExerciseEntry = exercisePhrases?.funny_image_phrase;
  const funnyImageExerciseSelectionEntry =
    funnyImageExerciseEntry?.source_text && funnyImageExerciseEntry?.target_text
      ? {
          label: funnyImageExerciseEntry.label || "funny image",
          source: funnyImageExerciseEntry.source_text,
          target: funnyImageExerciseEntry.target_text,
        }
      : undefined;
  const regularWordExerciseEntries =
    item.item_type === "word"
      ? [
          {
            label: "word",
            source: sourceText,
            target: targetText,
          },
          ...generatedWordExerciseEntries,
        ]
      : generatedWordExerciseEntries;
  const wordExerciseEntries =
    item.item_type === "word"
      ? [
          ...regularWordExerciseEntries,
          ...(funnyImageExerciseSelectionEntry
            ? [funnyImageExerciseSelectionEntry]
            : []),
        ]
      : regularWordExerciseEntries;
  const isVerbWord =
    item.item_type === "word" &&
    String(wordType || "")
      .trim()
      .toLowerCase() === "verb";
  const { nounExerciseSections, isNounSectionedExercise } =
    useNounExerciseModal({
      itemType: item.item_type,
      wordType,
      exercisePhrases,
    });
  const verbExerciseGridEntries = buildVerbExerciseGridEntries(
    generatedWordExerciseEntries,
  );
  const hasVerbExerciseGridEntries = verbExerciseGridEntries.length > 0;
  const hasCurrentVerbExerciseGeneration =
    exercisePhrases?.generation_mode === VERB_BY_TENSE_GENERATION_MODE;
  const isVerbExerciseGrid =
    item.item_type === "word" && (isVerbWord || hasVerbExerciseGridEntries);
  const wordOnlyExerciseEntry =
    item.item_type === "word"
      ? wordExerciseEntries.find((entry) => entry.label === "word")
      : undefined;
  const nounPluralExerciseEntry = isNounSectionedExercise
    ? buildGermanPluralExerciseEntry(wordOnlyExerciseEntry, pluralGerman, notes)
    : undefined;

  const compareExerciseWords = item.item_type === "word" ? compareWords : [];
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
    const compareSavedEntries = sanitizeExerciseEntries(
      exercisePhrasePayload?.phrases,
    );
    const compareLegacyEntries = [
      ...sanitizeExerciseEntries(exercisePhrasePayload?.first_section),
      ...sanitizeExerciseEntries(exercisePhrasePayload?.second_section),
    ];
    const compareGeneratedEntries = compareSavedEntries.length
      ? compareSavedEntries
      : compareLegacyEntries;
    const compareFunnyImageEntry = exercisePhrasePayload?.funny_image_phrase;
    const compareFunnyImageSelectionEntry =
      compareFunnyImageEntry?.source_text && compareFunnyImageEntry?.target_text
        ? [
            {
              label: wordLabel
                ? `${wordLabel} - ${compareFunnyImageEntry.label || "funny image"}`
                : compareFunnyImageEntry.label || "funny image",
              source: compareFunnyImageEntry.source_text,
              target: compareFunnyImageEntry.target_text,
            },
          ]
        : [];
    const labeledGeneratedEntries = compareGeneratedEntries.map((entry) => ({
      ...entry,
      label: wordLabel ? `${wordLabel} - ${entry.label}` : entry.label,
    }));
    return [
      compareWordEntry,
      ...labeledGeneratedEntries,
      ...compareFunnyImageSelectionEntry,
    ];
  };
  const compareExerciseEntries =
    item.item_type === "word"
      ? compareExerciseWords.flatMap((word) =>
          compareWordExerciseEntries(word, word.exercise_phrases),
        )
      : [];
  const allWordExerciseEntries =
    item.item_type === "word"
      ? [
          ...wordExerciseEntries,
          ...(nounPluralExerciseEntry ? [nounPluralExerciseEntry] : []),
          ...compareExerciseEntries,
        ]
      : wordExerciseEntries;
  const selectedRepeatExerciseEntries =
    item.item_type === "phrase"
      ? [{ source: sourceText, target: targetText }]
      : allWordExerciseEntries.filter((entry) =>
          selectedExerciseKeys.includes(exerciseEntryKey(entry)),
        );
  const selectedCreateEntries = createStrategy.entries.filter((entry) =>
    createStrategy.selectedKeys.includes(exerciseEntryKey(entry)),
  );
  const selectedExamplesEntries = examplesStrategy.entries.filter((entry) =>
    examplesStrategy.selectedKeys.includes(exerciseEntryKey(entry)),
  );
  const selectedRelatedEntries = relatedStrategy.allEntries
    .filter((entry) => relatedStrategy.selectedKeys.includes(entry.key))
    .map((entry) => ({
      label: "related",
      source: entry.exampleSource,
      target: entry.exampleTarget,
    }));
  const selectedVisualizeEntries =
    visualizeStrategy.entry &&
    visualizeStrategy.selectedKeys.includes(visualizeStrategy.entry.key)
      ? [visualizeStrategy.entry]
      : [];
  const selectedActEntries =
    actStrategy.entry &&
    actStrategy.selectedKeys.includes(actStrategy.entry.key)
      ? [actStrategy.entry]
      : [];
  const selectedWalkEntries = walkStrategy.entries.filter((entry) =>
    walkStrategy.selectedKeys.includes(exerciseEntryKey(entry)),
  );
  const selectedDecodeEntries = decodeStrategy.analysis.related
    .filter((entry) => decodeStrategy.selectedKeys.includes(entry.key))
    .map((entry) => ({
      label: "decode",
      source: entry.exampleSource,
      target: entry.exampleTarget,
    }));
  const selectedEncounterEntries = encounterStrategy.entries.filter((entry) =>
    encounterStrategy.selectedKeys.includes(entry.key),
  );
  const selectedCompareEntries = compareStrategy.entries
    .filter((entry) => compareStrategy.selectedKeys.includes(entry.key))
    .flatMap((entry) => [
      {
        label: `${entry.targetWord} - target`,
        source: entry.targetTranslation,
        target: entry.targetExample,
      },
      {
        label: `${entry.targetWord} - comparison`,
        source: entry.comparisonTranslation,
        target: entry.comparisonExample,
      },
    ]);
  const selectedStrategyEntries =
    selectedStrategy === CREATE_STRATEGY
      ? selectedCreateEntries
      : selectedStrategy === EXAMPLES_STRATEGY
        ? selectedExamplesEntries
        : selectedStrategy === RELATED_STRATEGY
          ? selectedRelatedEntries
          : selectedStrategy === VISUALIZE_STRATEGY
            ? selectedVisualizeEntries
            : selectedStrategy === ACT_STRATEGY
              ? selectedActEntries
              : selectedStrategy === WALK_STRATEGY
                ? selectedWalkEntries
                : selectedStrategy === DECODE_STRATEGY
                  ? selectedDecodeEntries
                  : selectedStrategy === ENCOUNTER_STRATEGY
                    ? selectedEncounterEntries
                    : selectedStrategy === COMPARE_STRATEGY
                      ? selectedCompareEntries
                      : selectedRepeatExerciseEntries;
  const selectedExerciseEntries = selectedStrategyEntries;
  const exerciseLines = selectedExerciseEntries.map((entry) => entry.target);
  const {
    secondsLeft: exerciseSecondsLeft,
    isRunning: exerciseRunning,
    isMuted: exerciseMuted,
    start: startExercise,
    stop: stopExercise,
    toggleMute: toggleExerciseMute,
  } = useRepeatExerciseLoop({
    defaultLines: exerciseLines,
    audioSources: item.item_type === "phrase" && audioUrl ? [audioUrl] : [],
    targetLanguage,
    preferredBrowserVoiceURI,
  });
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
  const wordPartsPracticeItem: SessionItem = {
    ...wordPracticeItemBase,
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
    return deterministicTake(
      keys,
      count,
      `${itemDeterministicKey}:exercise-keys:${count}`,
      (key) => key,
    );
  };

  const verbExerciseKeysForPerson = (person: VerbPersonKey): string[] =>
    getVerbExerciseKeysForPerson(
      verbExerciseGridEntries,
      exerciseEntryKey,
      person,
    );

  const verbExerciseKeysForTense = (tense: VerbTenseKey): string[] =>
    getVerbExerciseKeysForTense(
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

  useEffect(() => {
    if (!showExerciseModal || item.item_type !== "word") {
      setSelectedExerciseKeys([]);
      return;
    }
    setSelectedExerciseKeys([]);
  }, [
    showExerciseModal,
    item.id,
    item.item_type,
    isVerbExerciseGrid,
    itemDeterministicKey,
    compareWords,
  ]);

  useEffect(() => {
    if (!showExerciseModal) {
      setSelectedStrategy(firstStrategyForItemType(item.item_type));
      setSuppressInitialStrategyAutogeneration(false);
      return;
    }
    if (item.item_type !== "word" && selectedStrategy === CREATE_STRATEGY) {
      setSelectedStrategy(firstStrategyForItemType(item.item_type));
    }
  }, [showExerciseModal, item.item_type, selectedStrategy]);

  useEffect(() => {
    if (!showExerciseModal || !suppressInitialStrategyAutogeneration) {
      return;
    }
    if (selectedStrategy !== initialModalStrategy) {
      setSuppressInitialStrategyAutogeneration(false);
    }
  }, [
    showExerciseModal,
    suppressInitialStrategyAutogeneration,
    selectedStrategy,
    initialModalStrategy,
  ]);

  const toggleExerciseEntry = (entry: {
    label?: string;
    source: string;
    target: string;
  }): void => {
    const key = exerciseEntryKey(entry);
    setSelectedExerciseKeys((current) =>
      current.includes(key)
        ? current.filter((selectedKey) => selectedKey !== key)
        : [...current, key],
    );
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

  const compareWordNeedsExerciseGeneration = (
    word: NonNullable<SessionItem["compare_words"]>[number],
  ): boolean => {
    return compareWordExerciseEntries(word, word.exercise_phrases).length <= 1;
  };

  const ensureWordExerciseContentLoaded = async (): Promise<void> => {
    if (loadingExercises || item.item_type !== "word") {
      return;
    }
    let nextCompareWords = compareWords;
    setLoadingExercises(true);
    setExerciseError("");
    try {
      const shouldGenerateCurrentWordExercises =
        item.id > 0 &&
        (generatedWordExerciseEntries.length === 0 ||
          (isVerbWord &&
            (!hasVerbExerciseGridEntries ||
              !hasCurrentVerbExerciseGeneration)));
      const missingCompareWords = nextCompareWords.filter(
        (word) => word.id > 0 && compareWordNeedsExerciseGeneration(word),
      );
      if (shouldGenerateCurrentWordExercises) {
        const payload = await generateContentItemExercises(
          item.id,
          sourceLanguage,
          targetLanguage,
        );
        setExercisePhrases(payload.exercise_phrases || {});
      }
      if (missingCompareWords.length > 0) {
        const generatedCompareWords = await Promise.all(
          missingCompareWords.map(async (word) => {
            const payload = await generateContentItemExercises(
              word.id,
              sourceLanguage,
              targetLanguage,
            );
            return {
              id: word.id,
              exercise_phrases: payload.exercise_phrases || {},
            };
          }),
        );
        const generatedCompareWordMap = new Map(
          generatedCompareWords.map((word) => [word.id, word.exercise_phrases]),
        );
        setCompareWords((current) =>
          current.map((word) =>
            generatedCompareWordMap.has(word.id)
              ? {
                  ...word,
                  exercise_phrases: generatedCompareWordMap.get(word.id) || {},
                }
              : word,
          ),
        );
      }
    } catch {
      setExerciseError(t("newItem.exercisesGenerationError"));
    } finally {
      setLoadingExercises(false);
    }
  };

  const openExerciseModal = async (): Promise<void> => {
    if (showExerciseModal) {
      return;
    }
    setExerciseError("");
    if (item.item_type === "word" && item.id > 0) {
      try {
        const detail = await fetchContentItemDetail(
          item.id,
          sourceLanguage,
          targetLanguage,
        );
        setCompareWords(detail.compare_words || []);
        setCompareWordsInsights(detail.compare_words_insights || "");
      } catch {
        setExerciseError(t("manage.error.load"));
      }
    }
    const firstStrategy = firstStrategyForItemType(item.item_type);
    setSelectedStrategy(firstStrategy);
    setInitialModalStrategy(firstStrategy);
    setSuppressInitialStrategyAutogeneration(true);
    setShowExerciseModal(true);
  };

  useEffect(() => {
    if (
      !showExerciseModal ||
      item.item_type !== "word" ||
      selectedStrategy !== DEFAULT_STRATEGY ||
      suppressInitialStrategyAutogeneration
    ) {
      return;
    }
    void ensureWordExerciseContentLoaded();
  }, [
    showExerciseModal,
    item.item_type,
    selectedStrategy,
    suppressInitialStrategyAutogeneration,
    item.id,
    sourceLanguage,
    targetLanguage,
    compareWords,
    generatedWordExerciseEntries.length,
    isVerbWord,
    hasVerbExerciseGridEntries,
    hasCurrentVerbExerciseGeneration,
  ]);

  const generateNounExerciseCase = async (
    caseKey: "nominative" | "accusative" | "dative" | "genitive",
  ): Promise<void> => {
    if (generatingNounCaseKey || item.id <= 0) {
      return;
    }
    setExerciseError("");
    setGeneratingNounCaseKey(caseKey);
    try {
      const payload = await generateContentItemNounExerciseCase(
        item.id,
        caseKey,
        sourceLanguage,
        targetLanguage,
      );
      setExercisePhrases(payload.exercise_phrases || {});
    } catch (error) {
      setExerciseError(
        error instanceof Error ? error.message : t("newItem.wordRefreshError"),
      );
    } finally {
      setGeneratingNounCaseKey("");
    }
  };

  const generateFunnyImageExercise = async (): Promise<void> => {
    if (
      generatingFunnyImageExercise ||
      item.item_type !== "word" ||
      item.id <= 0
    ) {
      return;
    }
    setExerciseError("");
    setGeneratingFunnyImageExercise(true);
    try {
      const payload = await generateContentItemFunnyImageExercise(
        item.id,
        sourceLanguage,
        targetLanguage,
      );
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
      const payload = await generateContentItemExercises(
        item.id,
        sourceLanguage,
        targetLanguage,
      );
      setExercisePhrases(payload.exercise_phrases || {});
      setSelectedExerciseKeys([]);
    } catch {
      setExerciseError(t("newItem.exercisesGenerationError"));
    } finally {
      setLoadingExercises(false);
    }
  };

  const playFunnyImageWordAudio = (): void => {
    if (!targetText.trim()) return;
    if (exerciseRunning) stopExercise(false);
    playBrowserExerciseWord(targetText, targetLanguage, preferredBrowserVoiceURI);
  };

  const startFunnyImagePhraseExercise = (): void => {
    if (!funnyImageExerciseSelectionEntry) {
      return;
    }
    setSelectedExerciseKeys([
      exerciseEntryKey(funnyImageExerciseSelectionEntry),
    ]);
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

  const closeTestingModal = (): void => {
    setShowTestingModal(false);
    setDirectTestReviewComplete(false);
    setDirectTestCorrect(null);
  };

  const openTestingModal = (): void => {
    setSelectedTestingAction("test");
    setDirectTestReviewComplete(false);
    setDirectTestCorrect(null);
    setDirectTestResetVersion((value) => value + 1);
    setShowTestingModal(true);
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
        <button
          type="button"
          className="modal-corner-close"
          aria-label={t("words.close")}
          onClick={onClose}
        >
          ×
        </button>
      )}
      <section className="item-view-header-card">
        <p className="item-view-kicker">
          {item.item_type === "word" ? t("newItem.word") : t("newItem.phrase")}
        </p>
        <div className="item-view-title-row">
          <div className="item-view-title-block">
            <h2 className="item-view-title">{targetText || sourceText}</h2>
            <p className="item-view-subtitle">{sourceText}</p>
          </div>
        </div>
        <div className="item-view-meta-grid">
          {item.item_type === "word" && (
            <div className="item-view-meta-card">
              <span className="item-view-meta-label">
                {t("newItem.wordTypeLabel")}
              </span>
              <strong className="item-view-meta-value">
                {wordType || t("newItem.wordAddTypeUnknown")}
              </strong>
            </div>
          )}
          <div className="item-view-meta-card">
            <span className="item-view-meta-label">{t("newItem.notes")}</span>
            <strong className="item-view-meta-value item-view-meta-value-notes">
              {item.notes || "-"}
            </strong>
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
          showMobileActionLabels={showMobileActionLabels}
          hasQuestions={itemQuestions.length > 0}
          hasCompareWordsContent={
            compareWords.length > 0 || Boolean(compareWordsInsights.trim())
          }
          onOpenExercises={() => {
            void openExerciseModal();
          }}
          onOpenTesting={openTestingModal}
          onOpenRelatedDialogs={() => setShowDialogsModal(true)}
          onOpenQuestions={() => openQuestions()}
          onOpenCompareWords={openCompareWordsModal}
          onOpenAdminActions={() => itemAdminActions.setOpen(true)}
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
      <ItemAdminActionsModal
        open={itemAdminActions.open}
        isWord={item.item_type === "word"}
        isLearned={itemAdminActions.isLearned}
        activeAction={itemAdminActions.activeAction}
        message={itemAdminActions.message}
        error={itemAdminActions.error}
        onClose={() => itemAdminActions.setOpen(false)}
        onRegenerateItem={itemAdminActions.regenerateItem}
        onRescanDialogs={itemAdminActions.rescanDialogs}
        onRegenerateAudio={itemAdminActions.regenerateAudio}
        onToggleLearned={itemAdminActions.toggleLearned}
        onDelete={itemAdminActions.deleteItem}
      />
      {exerciseError && !showExerciseModal && (
        <p className="error">{exerciseError}</p>
      )}
      {!readOnly && (
        <div className="actions">
          <button
            type="button"
            className="item-got-it-button"
            onClick={markAsSeen}
            disabled={saving}
          >
            {saving ? t("newItem.saving") : continueLabel || t("newItem.gotIt")}
          </button>
        </div>
      )}
      {showDialogsModal &&
        (item.item_type === "word" || item.item_type === "phrase") && (
          <div
            className="blocking-modal-overlay"
            role="dialog"
            aria-modal="true"
          >
            <div className="blocking-modal related-dialogs-modal">
              <button
                type="button"
                className="modal-corner-close"
                aria-label={t("newItem.closeRelatedDialogs")}
                onClick={() => setShowDialogsModal(false)}
              >
                ×
              </button>
              <p>
                <strong>
                  {t("newItem.relatedDialogs", {
                    count: relatedDialogs.length,
                  })}
                </strong>
              </p>
              {!relatedDialogs.length && <p>{t("newItem.noRelatedDialogs")}</p>}
              {!!relatedDialogs.length && (
                <div className="related-dialogs-scroll">
                  {(showAllDialogs
                    ? relatedDialogs
                    : relatedDialogs.slice(0, 2)
                  ).map((dialog) => {
                    const showDialogTargetText =
                      targetPromptMode === "text" ||
                      Boolean(showDialogTargetTextById[dialog.dialog_id]);
                    const hideDialogTargetText =
                      targetPromptMode === "audio" && !showDialogTargetText;
                    const matchedTurnIndexes = new Set(
                      dialog.matched_turns.map((turn) => turn.turn_index),
                    );
                    return (
                      <div
                        key={dialog.dialog_id}
                        ref={(element) =>
                          registerRelatedDialogCardRef(
                            dialog.dialog_id,
                            element,
                          )
                        }
                        className="related-dialog-card"
                      >
                        <p>
                          <strong>{dialog.topic}</strong>
                        </p>
                        <p>
                          <strong>{t("newItem.dialogContext")}:</strong>{" "}
                          {dialog.context || t("newItem.dialogNoContext")}
                        </p>
                        {!!dialog.turns.length && (
                          <>
                            <p>
                              <strong>{t("newItem.dialogTurns")}:</strong>
                            </p>
                            <div className="dialog-list-controls related-dialog-sticky-controls">
                              <div
                                className="item-action-group"
                                aria-label={t("newItem.actionGroupExplore")}
                              >
                                <button
                                  type="button"
                                  className="secondary-button exercise-action-icon-button dialog-list-action-button"
                                  onClick={() => {
                                    if (
                                      playingRelatedDialogId ===
                                      dialog.dialog_id
                                    ) {
                                      stopRelatedDialogPlayback();
                                      return;
                                    }
                                    void playRelatedDialog(dialog);
                                  }}
                                  disabled={Boolean(
                                    loadingRelatedDialogAudioKey,
                                  )}
                                  aria-label={
                                    playingRelatedDialogId === dialog.dialog_id
                                      ? t("dialogs.stopDialog")
                                      : t("dialogs.playDialog")
                                  }
                                  title={
                                    playingRelatedDialogId === dialog.dialog_id
                                      ? t("dialogs.stopDialog")
                                      : t("dialogs.playDialog")
                                  }
                                  onPointerEnter={(event) =>
                                    showItemActionTooltip(
                                      event,
                                      playingRelatedDialogId ===
                                        dialog.dialog_id
                                        ? t("dialogs.stopDialog")
                                        : t("dialogs.playDialog"),
                                    )
                                  }
                                  onPointerLeave={hideItemActionTooltip}
                                  onFocus={(event) =>
                                    showItemActionTooltip(
                                      event,
                                      playingRelatedDialogId ===
                                        dialog.dialog_id
                                        ? t("dialogs.stopDialog")
                                        : t("dialogs.playDialog"),
                                    )
                                  }
                                  onBlur={hideItemActionTooltip}
                                >
                                  <DialogActionIcon
                                    name={
                                      playingRelatedDialogId ===
                                      dialog.dialog_id
                                        ? "stop"
                                        : "play"
                                    }
                                  />
                                </button>
                                {targetPromptMode === "audio" && (
                                  <button
                                    type="button"
                                    className="secondary-button exercise-action-icon-button dialog-list-action-button"
                                    onClick={() =>
                                      setShowDialogTargetTextById(
                                        (current) => ({
                                          ...current,
                                          [dialog.dialog_id]:
                                            !current[dialog.dialog_id],
                                        }),
                                      )
                                    }
                                    aria-label={
                                      showDialogTargetText
                                        ? t("prompt.hideText")
                                        : t("prompt.showText")
                                    }
                                    title={
                                      showDialogTargetText
                                        ? t("prompt.hideText")
                                        : t("prompt.showText")
                                    }
                                    aria-pressed={showDialogTargetText}
                                    onPointerEnter={(event) =>
                                      showItemActionTooltip(
                                        event,
                                        showDialogTargetText
                                          ? t("prompt.hideText")
                                          : t("prompt.showText"),
                                      )
                                    }
                                    onPointerLeave={hideItemActionTooltip}
                                    onFocus={(event) =>
                                      showItemActionTooltip(
                                        event,
                                        showDialogTargetText
                                          ? t("prompt.hideText")
                                          : t("prompt.showText"),
                                      )
                                    }
                                    onBlur={hideItemActionTooltip}
                                  >
                                    <DialogActionIcon name="text" />
                                  </button>
                                )}
                                <DialogTurnAudioModeButton
                                  mode={relatedDialogTurnAudioMode}
                                  onToggle={() =>
                                    setRelatedDialogTurnAudioMode((current) =>
                                      current === "natural"
                                        ? "clear"
                                        : "natural",
                                    )
                                  }
                                />
                                <button
                                  type="button"
                                  className="secondary-button exercise-action-icon-button dialog-list-action-button"
                                  onClick={() =>
                                    scrollToNextRelatedDialog(
                                      (showAllDialogs
                                        ? relatedDialogs
                                        : relatedDialogs.slice(0, 2)
                                      ).map((entry) => entry.dialog_id),
                                      dialog.dialog_id,
                                    )
                                  }
                                  aria-label={t("newItem.nextDialog")}
                                  title={t("newItem.nextDialog")}
                                  onPointerEnter={(event) =>
                                    showItemActionTooltip(
                                      event,
                                      t("newItem.nextDialog"),
                                    )
                                  }
                                  onPointerLeave={hideItemActionTooltip}
                                  onFocus={(event) =>
                                    showItemActionTooltip(
                                      event,
                                      t("newItem.nextDialog"),
                                    )
                                  }
                                  onBlur={hideItemActionTooltip}
                                >
                                  <DialogActionIcon name="next" />
                                </button>
                              </div>
                              <div
                                className="item-action-group item-action-group-danger"
                                aria-label={t("newItem.actionGroupDanger")}
                              >
                                <DangerousButton
                                  type="button"
                                  className="secondary-button exercise-action-icon-button dialog-list-action-button"
                                  onConfirm={() =>
                                    regenerateRelatedDialogAudio(
                                      dialog.dialog_id,
                                    )
                                  }
                                  disabled={
                                    regeneratingRelatedDialogId ===
                                    dialog.dialog_id
                                  }
                                  aria-label={
                                    regeneratingRelatedDialogId ===
                                    dialog.dialog_id
                                      ? t("dialogs.loading")
                                      : t("manage.regenerateAudio")
                                  }
                                  title={
                                    regeneratingRelatedDialogId ===
                                    dialog.dialog_id
                                      ? t("dialogs.loading")
                                      : t("manage.regenerateAudio")
                                  }
                                  onPointerEnter={(event) =>
                                    showItemActionTooltip(
                                      event,
                                      regeneratingRelatedDialogId ===
                                        dialog.dialog_id
                                        ? t("dialogs.loading")
                                        : t("manage.regenerateAudio"),
                                    )
                                  }
                                  onPointerLeave={hideItemActionTooltip}
                                  onFocus={(event) =>
                                    showItemActionTooltip(
                                      event,
                                      regeneratingRelatedDialogId ===
                                        dialog.dialog_id
                                        ? t("dialogs.loading")
                                        : t("manage.regenerateAudio"),
                                    )
                                  }
                                  onBlur={hideItemActionTooltip}
                                >
                                  <DialogActionIcon name="refresh" />
                                </DangerousButton>
                              </div>
                            </div>
                            <RelatedDialogTurns
                              dialog={dialog}
                              sourceLanguage={sourceLanguage}
                              targetLanguage={targetLanguage}
                              hideTargetText={hideDialogTargetText}
                              turnAudioMode={relatedDialogTurnAudioMode}
                              playingDialogId={playingRelatedDialogId}
                              playingTurn={playingRelatedDialogTurn}
                              loadingTurnAudioKey={loadingRelatedDialogAudioKey}
                              matchedTurnIndexes={matchedTurnIndexes}
                              wordActionStatus={wordActionStatus}
                              phraseActionStatus={phraseActionStatus}
                              phraseActionError={phraseActionError}
                              onOpenItem={openLinkedDialogItem}
                              onTokenClick={(
                                statusKey,
                                token,
                                turnIndex,
                                sourceText,
                                targetTextLine,
                              ) =>
                                void requestAddWordFromDialogToken(
                                  statusKey,
                                  token,
                                  token,
                                  dialog.dialog_id,
                                  turnIndex,
                                  sourceText,
                                  targetTextLine,
                                )
                              }
                              onPlayTurn={playRelatedDialogTurn}
                              onSaveWholeTurn={addWholeTurnPhraseFromRelatedDialog}
                              wholeTurnPhraseKey={wholeTurnPhraseKey}
                              onShowTooltip={showItemActionTooltip}
                              onHideTooltip={hideItemActionTooltip}
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
                  <button
                    type="button"
                    onClick={() => setShowAllDialogs((value) => !value)}
                  >
                    {showAllDialogs
                      ? t("newItem.hideMoreDialogs")
                      : t("newItem.showMoreDialogs")}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      {showWordIntroPracticeModal && item.item_type === "word" && (
        <div className="blocking-modal-overlay" role="dialog" aria-modal="true">
          <div className="blocking-modal related-dialogs-modal phrase-builder-modal">
            <button
              type="button"
              className="modal-corner-close"
              aria-label={t("newItem.closeRelatedDialogs")}
              onClick={closeWordIntroPracticeModal}
            >
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
      {showTestingModal &&
        (item.item_type === "word" || item.item_type === "phrase") && (
          <ItemTestingModal
            itemType={item.item_type}
            selectedActionKey={selectedTestingAction}
            onSelectedActionKeyChange={(value) => {
              setSelectedTestingAction(value);
              setDirectTestReviewComplete(false);
              setDirectTestCorrect(null);
              setDirectTestResetVersion((current) => current + 1);
            }}
            onClose={closeTestingModal}
            testingContent={
              selectedTestingAction === "warmup" &&
              item.item_type === "word" ? (
                <WordReview
                  key={`testing-word-intro-practice-${item.id}-${sourceText}-${targetText}-${selectedTestingAction}`}
                  item={wordIntroPracticeItem}
                  onAnswered={async () => closeTestingModal()}
                />
              ) : selectedTestingAction === "letters" &&
                item.item_type === "word" ? (
                <WordReview
                  key={`testing-word-letter-practice-${item.id}-${sourceText}-${targetText}-${selectedTestingAction}`}
                  item={wordLetterPracticeItem}
                  onAnswered={async () => closeTestingModal()}
                />
              ) : selectedTestingAction === "parts" &&
                item.item_type === "word" ? (
                <WordPartsReview
                  key={`testing-word-parts-practice-${item.id}-${sourceText}-${targetText}-${selectedTestingAction}`}
                  item={wordPartsPracticeItem}
                  onAnswered={async () => closeTestingModal()}
                />
              ) : selectedTestingAction === "builder" &&
                item.item_type === "phrase" ? (
                <PhraseReview
                  key={`testing-phrase-builder-${item.id}-${sourceText}-${targetText}-${selectedTestingAction}`}
                  item={phraseBuilderItem}
                  onAnswered={async () => closeTestingModal()}
                />
              ) : item.item_type === "word" ? (
                <WordReview
                  key={`testing-direct-word-test-${item.id}-${sourceText}-${targetText}-${relatedDialogs.length}-${directTestResetVersion}`}
                  item={directTestItem}
                  onAnswered={registerDirectTestAnswer}
                  reviewComplete={directTestReviewComplete}
                  onNextItem={async () => closeTestingModal()}
                />
              ) : (
                <PhraseReview
                  key={`testing-direct-phrase-test-${item.id}-${sourceText}-${targetText}-${directTestResetVersion}`}
                  item={directTestItem}
                  onAnswered={registerDirectTestAnswer}
                  reviewComplete={directTestReviewComplete}
                  onNextItem={async () => closeTestingModal()}
                />
              )
            }
          />
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
      {showDirectTestModal &&
        (item.item_type === "word" || item.item_type === "phrase") && (
          <div
            className="blocking-modal-overlay"
            role="dialog"
            aria-modal="true"
          >
            <div className="blocking-modal related-dialogs-modal phrase-builder-modal">
              <button
                type="button"
                className="modal-corner-close"
                aria-label={t("newItem.closeRelatedDialogs")}
                onClick={closeDirectTestModal}
              >
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
            <button
              type="button"
              className="modal-corner-close"
              aria-label={t("newItem.closeRelatedDialogs")}
              onClick={closeWordLetterPracticeModal}
            >
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
            <button
              type="button"
              className="modal-corner-close"
              aria-label={t("newItem.closeRelatedDialogs")}
              onClick={closePhraseBuilderModal}
            >
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
      {showExerciseModal &&
        (item.item_type === "word" || item.item_type === "phrase") && (
          <ItemStrategiesModal
            itemType={item.item_type}
            sourceText={sourceText}
            targetText={targetText}
            targetLanguage={targetLanguage}
            wordType={wordType}
            pluralGerman={pluralGerman}
            selectedStrategy={selectedStrategy}
            onSelectedStrategyChange={setSelectedStrategy}
            onClose={closeExerciseModal}
            exerciseSecondsLeft={exerciseSecondsLeft}
            exerciseRunning={exerciseRunning}
            exerciseMuted={exerciseMuted}
            canStart={exerciseLines.length > 0}
            onStart={startExercise}
            onStop={stopExercise}
            onToggleMute={toggleExerciseMute}
            formsContent={
              <FormsStrategyPanel
                itemType={item.item_type}
                targetText={targetText}
                sourceText={sourceText}
                sourceLanguageLabel={sourceLanguageLabel}
                loadingExercises={loadingExercises}
                exerciseError={exerciseError}
                exerciseRunning={exerciseRunning}
                wordExerciseEntries={wordExerciseEntries}
                selectedExerciseKeys={selectedExerciseKeys}
                funnyImageExerciseSelectionEntry={
                  funnyImageExerciseSelectionEntry
                }
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
                openImageIcon={<ItemActionIcon name="openImage" />}
                exerciseEntryKey={exerciseEntryKey}
              />
            }
            formsFooterAction={
              item.item_type === "word" ? (
                <WordExerciseActions
                  exerciseRunning={exerciseRunning}
                  loadingExercises={loadingExercises}
                  generatingFunnyImageExercise={generatingFunnyImageExercise}
                  hasWordExercises={wordExerciseEntries.length > 0}
                  hasFunnyImage={Boolean(funnyImageExerciseSelectionEntry)}
                  hasOpenFunnyImage={false}
                  onOpenFunnyImage={() => {}}
                  onGenerateFunnyImage={() => {
                    void generateFunnyImageExercise();
                  }}
                  openImageIcon={null}
                  imageIcon={<ItemActionIcon name="image" />}
                  showOpenImage={false}
                />
              ) : undefined
            }
            canRegenerateContent={
              item.item_type === "word" &&
              item.id > 0 &&
              (selectedStrategy === DEFAULT_STRATEGY ||
                selectedStrategy === EXAMPLES_STRATEGY ||
                selectedStrategy === RELATED_STRATEGY ||
                selectedStrategy === VISUALIZE_STRATEGY ||
                selectedStrategy === ACT_STRATEGY ||
                selectedStrategy === WALK_STRATEGY ||
                selectedStrategy === DECODE_STRATEGY ||
                selectedStrategy === ENCOUNTER_STRATEGY ||
                selectedStrategy === COMPARE_STRATEGY)
            }
            regeneratingContent={
              selectedStrategy === EXAMPLES_STRATEGY
                ? examplesStrategy.isLoading
                : selectedStrategy === RELATED_STRATEGY
                  ? relatedStrategy.isLoading
                  : selectedStrategy === VISUALIZE_STRATEGY
                    ? visualizeStrategy.isLoading
                    : selectedStrategy === ACT_STRATEGY
                      ? actStrategy.isLoading
                      : selectedStrategy === WALK_STRATEGY
                        ? walkStrategy.isLoading
                        : selectedStrategy === DECODE_STRATEGY
                          ? decodeStrategy.isLoading
                          : selectedStrategy === ENCOUNTER_STRATEGY
                            ? encounterStrategy.isLoading
                            : selectedStrategy === COMPARE_STRATEGY
                              ? compareStrategy.isLoading
                              : loadingExercises
            }
            onRegenerateContent={() => {
              if (selectedStrategy === EXAMPLES_STRATEGY) {
                void examplesStrategy.generate();
                return;
              }
              if (selectedStrategy === RELATED_STRATEGY) {
                void relatedStrategy.generate();
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
              if (selectedStrategy === ENCOUNTER_STRATEGY) {
                void encounterStrategy.generate();
                return;
              }
              if (selectedStrategy === COMPARE_STRATEGY) {
                void compareStrategy.generate();
                return;
              }
              void regenerateWordExercises();
            }}
            formsSelection={{
              canSelectEntries:
                wordExerciseEntries.length > 0 ||
                compareExerciseEntries.length > 0 ||
                item.item_type === "phrase",
              hasSelectedEntries:
                selectedExerciseKeys.length > 0 || item.item_type === "phrase",
              onUnselectAll: unselectAllExerciseEntries,
              onSelectAll: selectAllExerciseEntries,
              onSelectRandom: selectRandomExerciseEntries,
            }}
            createStrategy={{
              inputValue: createStrategy.inputValue,
              setInputValue: createStrategy.setInputValue,
              generatePhrase: createStrategy.generatePhrase,
              isGenerating: createStrategy.isGenerating,
              error: createStrategy.error,
              entries: createStrategy.entries.map((entry) => ({
                ...entry,
                key: exerciseEntryKey(entry),
              })),
              selectedKeys: createStrategy.selectedKeys,
              toggleEntry: createStrategy.toggleEntry,
              unselectAll: createStrategy.unselectAll,
              selectAll: createStrategy.selectAll,
              selectRandom: createStrategy.selectRandom,
            }}
            examplesStrategy={{
              entries: examplesStrategy.entries.map((entry) => ({
                ...entry,
                key: exerciseEntryKey(entry),
              })),
              selectedKeys: examplesStrategy.selectedKeys,
              toggleEntry: examplesStrategy.toggleEntry,
              isLoading: examplesStrategy.isLoading,
              error: examplesStrategy.error,
              unselectAll: examplesStrategy.unselectAll,
              selectAll: examplesStrategy.selectAll,
              selectRandom: examplesStrategy.selectRandom,
            }}
            relatedStrategy={relatedStrategy}
            visualizeStrategy={visualizeStrategy}
            onPlayVisualizeWord={playFunnyImageWordAudio}
            actStrategy={actStrategy}
            walkStrategy={{
              entries: walkStrategy.entries.map((entry) => ({
                ...entry,
                key: exerciseEntryKey(entry),
              })),
              selectedKeys: walkStrategy.selectedKeys,
              toggleEntry: walkStrategy.toggleEntry,
              isLoading: walkStrategy.isLoading,
              error: walkStrategy.error,
              unselectAll: walkStrategy.unselectAll,
              selectAll: walkStrategy.selectAll,
              selectRandom: walkStrategy.selectRandom,
            }}
            decodeStrategy={decodeStrategy}
            encounterStrategy={encounterStrategy}
            compareStrategy={compareStrategy}
            grammarStrategy={grammarStrategy}
            phraseGrammarStrategy={phraseGrammarStrategy}
            onAskAboutPhraseGrammarRule={(question, grammarFeatureKey) => openQuestions(question, { grammarFeatureKey })}
            onOpenPhraseGrammarExample={openLinkedDialogItem}
            phraseGrammarLoop={{
              secondsLeft: exerciseSecondsLeft,
              isRunning: exerciseRunning,
              isMuted: exerciseMuted,
              canStart: item.item_type === "phrase" && Boolean(audioUrl),
              originalAudioUrl: audioUrl,
              onStart: startExercise,
              onStop: stopExercise,
              onToggleMute: toggleExerciseMute,
            }}
          />
        )}
      {showFunnyImageModal &&
        funnyImageExerciseEntry?.image_url &&
        funnyImageExerciseSelectionEntry && (
          <div
            className="blocking-modal-overlay"
            role="dialog"
            aria-modal="true"
          >
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
                <img
                  src={funnyImageExerciseEntry.image_url}
                  alt={funnyImageExerciseSelectionEntry.target}
                />
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
          initialQuestion={prefilledQuestion}
          initialGrammarFeatureKey={prefilledGrammarFeatureKey}
          onClose={closeQuestions}
          onAskQuestion={askItemQuestion}
        />
      )}
      <DialogItemSavingModals
        pendingWordAdd={pendingWordAdd}
        addingWord={addingWord}
        openedItemContent={openedLinkedWord && (
          <NewItem
            item={openedLinkedWord}
            readOnly
            onClose={() => setOpenedLinkedWord(null)}
          />
        )}
        onCancelWordAdd={() => setPendingWordAdd(null)}
        onConfirmWordAdd={() => void confirmAddWordFromDialog()}
      />
      <FullScreenLoadingOverlay
        loading={savingDialogItem}
        message={t("loading.savingItem")}
      />
    </div>
  );
}
