import { useEffect, useState } from "react";

import { confirmContent, fetchContentItemDetail, fetchContentTopicContexts, fetchContentTopics, previewContent, quickAddPhraseFromConversation, quickAddWordFromDialog } from "../api";
import { useI18n } from "../i18n";
import { useStudyLanguages } from "../studyLanguages";
import type { ContentPreviewResponse, SessionItem } from "../types";
import NewItem from "./NewItem";
import ContentCreateFormCard from "./contentCreate/ContentCreateFormCard";
import ContentPreviewCard from "./contentCreate/ContentPreviewCard";
import SavedDialogCard from "./contentCreate/SavedDialogCard";

const CREATE_NEW_OPTION = "__create_new__";
const RANDOM_TOPIC_OPTION = "__random_topic__";
type DialogLength = "standard" | "short_three";
type RequiredWordsLanguage = "source" | "target";
type ProficiencyLevel = "A1" | "A2" | "B1" | "B2";
type PhraseActionStatus = "idle" | "saving" | "added" | "exists" | "error";

function buildSessionItemFromDetail(
  detail: Awaited<ReturnType<typeof fetchContentItemDetail>>,
  fallbackWordType = "",
): SessionItem {
  return {
    id: detail.id,
    item_type: detail.item_type,
    spanish_text: detail.spanish_text,
    german_text: detail.german_text,
    example_sentence: detail.example_sentence || "",
    notes: detail.notes || "",
    word_type: detail.word_type || fallbackWordType,
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
  };
}

export default function ContentCreatePage(): JSX.Element {
  const { t } = useI18n();
  const { sourceLanguage, targetLanguage } = useStudyLanguages();
  const [selectedTopic, setSelectedTopic] = useState<string>("");
  const [customTopic, setCustomTopic] = useState<string>("");
  const [selectedContext, setSelectedContext] = useState<string>("");
  const [customContext, setCustomContext] = useState<string>("");
  const [conversationDetails, setConversationDetails] = useState<string>("");
  const [requiredWords, setRequiredWords] = useState<string>("");
  const [requiredWordsLanguage, setRequiredWordsLanguage] = useState<RequiredWordsLanguage>("target");
  const [dialogLength, setDialogLength] = useState<DialogLength>("standard");
  const [proficiencyLevel, setProficiencyLevel] = useState<ProficiencyLevel>("A2");
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [preview, setPreview] = useState<ContentPreviewResponse | null>(null);
  const [result, setResult] = useState<string>("");
  const [savedDialogId, setSavedDialogId] = useState<number | null>(null);
  const [savedDialogTurns, setSavedDialogTurns] = useState<Array<{ source_text: string; target_text: string; speaker?: "a" | "b"; phrase_audio_url?: string; clear_audio_url?: string }>>([]);
  const [phraseActionStatus, setPhraseActionStatus] = useState<Record<string, PhraseActionStatus>>({});
  const [phraseActionError, setPhraseActionError] = useState<Record<string, string>>({});
  const [previousTopics, setPreviousTopics] = useState<string[]>([]);
  const [previousContexts, setPreviousContexts] = useState<string[]>([]);
  const [wordActionStatus, setWordActionStatus] = useState<Record<string, "idle" | "saving" | "added" | "exists" | "error">>({});
  const [pendingWordAdd, setPendingWordAdd] = useState<{
    key: string;
    source: string;
    target: string;
    wordType: string;
    sourceLine: string;
    targetLine: string;
    clickedTargetToken: string;
    turnIndex: number;
    note: string;
  } | null>(null);
  const [addingWord, setAddingWord] = useState<boolean>(false);
  const [openedLinkedWord, setOpenedLinkedWord] = useState<SessionItem | null>(null);
  const [loadingLinkedWord, setLoadingLinkedWord] = useState<boolean>(false);

  useEffect(() => {
    let active = true;

    const loadTopics = async (): Promise<void> => {
      try {
        const response = await fetchContentTopics(sourceLanguage, targetLanguage);
        if (!active) {
          return;
        }
        setPreviousTopics(response.topics || []);
        setSelectedTopic(RANDOM_TOPIC_OPTION);
        setCustomTopic("");
        setPreviousContexts([]);
        setSelectedContext("");
        setCustomContext("");
        setConversationDetails("");
        setRequiredWords("");
        setRequiredWordsLanguage("target");
        setDialogLength("standard");
        setProficiencyLevel("A2");
        setPreview(null);
        setResult("");
        setSavedDialogTurns([]);
        setSavedDialogId(null);
        setPhraseActionStatus({});
        setPhraseActionError({});
        setWordActionStatus({});
        setPendingWordAdd(null);
        setError("");
      } catch {
        if (active) {
          setPreviousTopics([]);
          setSelectedTopic(RANDOM_TOPIC_OPTION);
          setCustomTopic("");
          setPreviousContexts([]);
          setSelectedContext("");
          setCustomContext("");
          setConversationDetails("");
          setRequiredWords("");
          setRequiredWordsLanguage("target");
          setDialogLength("standard");
          setProficiencyLevel("A2");
          setPreview(null);
          setResult("");
          setSavedDialogTurns([]);
          setSavedDialogId(null);
          setPhraseActionStatus({});
          setPhraseActionError({});
          setWordActionStatus({});
          setPendingWordAdd(null);
          setError("");
        }
      }
    };

    void loadTopics();
    return () => {
      active = false;
    };
  }, [sourceLanguage, targetLanguage]);

  useEffect(() => {
    let active = true;

    const loadContexts = async (): Promise<void> => {
      if (!selectedTopic.trim() || selectedTopic === CREATE_NEW_OPTION || selectedTopic === RANDOM_TOPIC_OPTION) {
        setPreviousContexts([]);
        setSelectedContext("");
        setCustomContext("");
        return;
      }
      try {
        const response = await fetchContentTopicContexts(selectedTopic.trim(), sourceLanguage, targetLanguage);
        if (!active) {
          return;
        }
        setPreviousContexts(response.contexts || []);
        setSelectedContext("");
        setCustomContext("");
      } catch {
        if (active) {
          setPreviousContexts([]);
          setSelectedContext("");
          setCustomContext("");
        }
      }
    };

    void loadContexts();
    return () => {
      active = false;
    };
  }, [selectedTopic, sourceLanguage, targetLanguage]);

  const resolvedTopic = (selectedTopic === CREATE_NEW_OPTION ? customTopic : selectedTopic).trim();
  const resolvedContext = (selectedContext === CREATE_NEW_OPTION ? customContext : selectedContext).trim();

  const cleanToken = (value: string): string => value.replace(/^[^A-Za-zÀ-ÖØ-öø-ÿ]+|[^A-Za-zÀ-ÖØ-öø-ÿ]+$/g, "").trim();

  const onGeneratePreview = async (): Promise<void> => {
    setError("");
    setResult("");
    setSavedDialogTurns([]);
    setSavedDialogId(null);
    setPhraseActionStatus({});
    setPhraseActionError({});
    setWordActionStatus({});
    setPendingWordAdd(null);
    setPreview(null);

    if (!resolvedTopic) {
      setError(previousTopics.length ? t("content.error.selectOrEnterTopic") : t("content.error.enterTopic"));
      return;
    }
    setLoading(true);
    try {
      const details = conversationDetails.trim();
      const required = requiredWords.trim();
      const data = await previewContent(
        resolvedTopic,
        resolvedContext,
        details,
        required,
        requiredWordsLanguage,
        dialogLength,
        proficiencyLevel,
        sourceLanguage,
        targetLanguage,
      );
      setPreview(data);
      const topicsResponse = await fetchContentTopics(sourceLanguage, targetLanguage);
      setPreviousTopics(topicsResponse.topics || []);
    } catch {
      setError(t("content.error.generatePreview"));
    } finally {
      setLoading(false);
    }
  };

  const onAcceptDialog = async (): Promise<void> => {
    if (!preview) {
      return;
    }

    setSaving(true);
    setError("");
    try {
      const response = await confirmContent(
        preview.topic,
        preview.dialog_turns,
        preview.context || "",
        preview.source_language || sourceLanguage,
        preview.target_language || targetLanguage,
        [],
        preview.proficiency_level || proficiencyLevel,
      );
      setResult(t("content.result.dialogAccepted"));
      setSavedDialogTurns(response.saved_dialog_turns || []);
      setSavedDialogId(response.saved_dialog_id || null);
      setPreview(null);
      setPhraseActionStatus({});
      setPhraseActionError({});
      const topicsResponse = await fetchContentTopics(sourceLanguage, targetLanguage);
      setPreviousTopics(topicsResponse.topics || []);
    } catch {
      setError(t("content.error.saveContent"));
    } finally {
      setSaving(false);
    }
  };

  const requestAddWordFromDialogToken = async (
    key: string,
    targetTokenRaw: string,
    turnIndex: number,
    sourceLine: string,
    targetLine: string,
  ): Promise<void> => {
    const targetToken = cleanToken(targetTokenRaw);
    if (!targetToken || !savedDialogId) {
      return;
    }

    setWordActionStatus((current) => ({ ...current, [key]: "saving" }));
    try {
      const check = await quickAddWordFromDialog(
        targetToken,
        targetToken,
        sourceLanguage,
        targetLanguage,
        savedDialogId,
        turnIndex,
        true,
        sourceLine,
        targetLine,
        targetToken,
      );
      if (check.exists) {
        if (!check.id) {
          setWordActionStatus((current) => ({ ...current, [key]: "error" }));
          return;
        }
        setLoadingLinkedWord(true);
        try {
          const detail = await fetchContentItemDetail(check.id, sourceLanguage, targetLanguage);
          setOpenedLinkedWord(buildSessionItemFromDetail(detail, check.word_type || ""));
          setWordActionStatus((current) => ({ ...current, [key]: "exists" }));
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
        source: check.source_text || targetToken,
        target: check.target_text || targetToken,
        wordType: resolvedWordType,
        sourceLine,
        targetLine,
        clickedTargetToken: targetToken,
        turnIndex,
        note: check.notes || "",
      });
    } catch {
      setWordActionStatus((current) => ({ ...current, [key]: "error" }));
    }
  };

  const confirmAddWordFromDialog = async (): Promise<void> => {
    if (!pendingWordAdd || !savedDialogId || addingWord) {
      return;
    }

    const { key, source, target, sourceLine, targetLine, clickedTargetToken, turnIndex } = pendingWordAdd;
    setWordActionStatus((current) => ({ ...current, [key]: "saving" }));
    setAddingWord(true);
    try {
      const resultPayload = await quickAddWordFromDialog(
        source,
        target,
        sourceLanguage,
        targetLanguage,
        savedDialogId,
        turnIndex,
        false,
        sourceLine,
        targetLine,
        clickedTargetToken,
      );
      setWordActionStatus((current) => ({ ...current, [key]: resultPayload.created ? "added" : "exists" }));
    } catch {
      setWordActionStatus((current) => ({ ...current, [key]: "error" }));
    } finally {
      setAddingWord(false);
      setPendingWordAdd(null);
    }
  };

  const wholeTurnPhraseKey = (turnIndex: number): string => `saved-${turnIndex}-whole-phrase`;

  const openPhraseItem = async (itemId: number): Promise<void> => {
    setLoadingLinkedWord(true);
    try {
      const detail = await fetchContentItemDetail(itemId, sourceLanguage, targetLanguage);
      setOpenedLinkedWord(buildSessionItemFromDetail(detail));
    } finally {
      setLoadingLinkedWord(false);
    }
  };

  const addWholeTurnPhraseFromDialog = async (
    turn: { source_text: string; target_text: string; speaker?: "a" | "b"; phrase_audio_url?: string },
    turnIndex: number,
  ): Promise<void> => {
    if (!savedDialogId || !turn.source_text.trim() || !turn.target_text.trim()) {
      return;
    }
    const statusKey = wholeTurnPhraseKey(turnIndex);
    setPhraseActionStatus((current) => ({ ...current, [statusKey]: "saving" }));
    setPhraseActionError((current) => ({ ...current, [statusKey]: "" }));
    try {
      const resultPayload = await quickAddPhraseFromConversation(
        turn.source_text,
        turn.target_text,
        sourceLanguage,
        targetLanguage,
        false,
        savedDialogId,
        turnIndex,
        turn.source_text,
        turn.target_text,
      );
      if (resultPayload.id) {
        await openPhraseItem(resultPayload.id);
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

  return (
    <main className="container" data-testid="content-create-page">
      <h1>{t("content.title")}</h1>

      <ContentCreateFormCard
        selectedTopic={selectedTopic}
        customTopic={customTopic}
        selectedContext={selectedContext}
        customContext={customContext}
        conversationDetails={conversationDetails}
        requiredWords={requiredWords}
        requiredWordsLanguage={requiredWordsLanguage}
        dialogLength={dialogLength}
        proficiencyLevel={proficiencyLevel}
        previousTopics={previousTopics}
        previousContexts={previousContexts}
        loading={loading}
        saving={saving}
        resolvedTopic={resolvedTopic}
        onSelectedTopicChange={setSelectedTopic}
        onCustomTopicChange={setCustomTopic}
        onSelectedContextChange={setSelectedContext}
        onCustomContextChange={setCustomContext}
        onConversationDetailsChange={setConversationDetails}
        onRequiredWordsChange={setRequiredWords}
        onRequiredWordsLanguageChange={setRequiredWordsLanguage}
        onDialogLengthChange={setDialogLength}
        onProficiencyLevelChange={setProficiencyLevel}
        onGeneratePreview={() => {
          void onGeneratePreview();
        }}
      />

      {error && <p className="error">{error}</p>}
      {result && <p>{result}</p>}

      {preview && (
        <ContentPreviewCard
          preview={preview}
          saving={saving}
          loading={loading}
          onAccept={() => {
            void onAcceptDialog();
          }}
          onDiscard={() => setPreview(null)}
        />
      )}

      {savedDialogTurns.length > 0 && (
        <SavedDialogCard
          savedDialogId={savedDialogId}
          savedDialogTurns={savedDialogTurns}
          sourceLanguage={sourceLanguage}
          targetLanguage={targetLanguage}
          wordActionStatus={wordActionStatus}
          phraseActionStatus={phraseActionStatus}
          phraseActionError={phraseActionError}
          onUpdateTurnAudio={(turnIndex, audioUrl, mode) => setSavedDialogTurns((current) => current.map((turn, index) => (
            index === turnIndex
              ? { ...turn, [mode === "clear" ? "clear_audio_url" : "phrase_audio_url"]: audioUrl }
              : turn
          )))}
          onOpenItem={openPhraseItem}
          onTokenClick={(statusKey, token, turnIndex, sourceText, targetText) => {
            void requestAddWordFromDialogToken(statusKey, token, turnIndex, sourceText, targetText);
          }}
          onSavePhrase={addWholeTurnPhraseFromDialog}
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

      {saving && (
        <div className="blocking-modal-overlay" role="alert" aria-live="assertive" aria-busy="true">
          <div className="blocking-modal">
            <p>{t("content.saving")}</p>
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
      {loadingLinkedWord && <p className="hint">{t("session.loading")}</p>}
    </main>
  );
}
