import { useEffect, useRef, useState } from "react";

import { confirmContent, fetchContentTopicContexts, fetchContentTopics, previewContent } from "../api";
import { useI18n } from "../i18n";
import { useStudyLanguages } from "../studyLanguages";
import type { ContentPreviewResponse } from "../types";
import { FullScreenLoadingOverlay } from "./BlockingLoadingOverlay";
import ContentCreateFormCard from "./contentCreate/ContentCreateFormCard";
import ContentPreviewCard from "./contentCreate/ContentPreviewCard";
import SavedDialogCard from "./contentCreate/SavedDialogCard";
import SavedDialogModals from "./contentCreate/SavedDialogModals";
import useSavedDialogInteractions from "./contentCreate/useSavedDialogInteractions";

const CREATE_NEW_OPTION = "__create_new__";
const RANDOM_TOPIC_OPTION = "__random_topic__";
type DialogLength = "standard" | "short_three";
type RequiredWordsLanguage = "source" | "target";
type ProficiencyLevel = "A1" | "A2" | "B1" | "B2";
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
  const [previousTopics, setPreviousTopics] = useState<string[]>([]);
  const [previousContexts, setPreviousContexts] = useState<string[]>([]);
  const previewRef = useRef<HTMLElement | null>(null);
  const savedDialog = useSavedDialogInteractions(sourceLanguage, targetLanguage, t("newItem.sentenceAddError"));

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
        savedDialog.reset();
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
          savedDialog.reset();
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

  const onGeneratePreview = async (): Promise<void> => {
    setError("");
    setResult("");
    savedDialog.reset();
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
      savedDialog.setSavedDialog(response.saved_dialog_id || null, response.saved_dialog_turns || []);
      setPreview(null);
      const topicsResponse = await fetchContentTopics(sourceLanguage, targetLanguage);
      setPreviousTopics(topicsResponse.topics || []);
    } catch {
      setError(t("content.error.saveContent"));
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!preview) return;
    const frame = requestAnimationFrame(() => previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    return () => cancelAnimationFrame(frame);
  }, [preview]);

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
        <section ref={previewRef}>
          <ContentPreviewCard
            preview={preview}
            saving={saving}
            loading={loading}
            onAccept={() => {
              void onAcceptDialog();
            }}
            onDiscard={() => setPreview(null)}
          />
        </section>
      )}

      {savedDialog.savedDialogTurns.length > 0 && (
        <SavedDialogCard
          savedDialogId={savedDialog.savedDialogId}
          savedDialogTurns={savedDialog.savedDialogTurns}
          sourceLanguage={sourceLanguage}
          targetLanguage={targetLanguage}
          wordActionStatus={savedDialog.wordActionStatus}
          phraseActionStatus={savedDialog.phraseActionStatus}
          phraseActionError={savedDialog.phraseActionError}
          onUpdateTurnAudio={savedDialog.updateTurnAudio}
          onOpenItem={savedDialog.openItem}
          onTokenClick={(statusKey, token, turnIndex, sourceText, targetText) => {
            void savedDialog.requestAddWord(statusKey, token, turnIndex, sourceText, targetText);
          }}
          onSavePhrase={savedDialog.addWholeTurnPhrase}
        />
      )}

      <SavedDialogModals
        pendingWordAdd={savedDialog.pendingWordAdd}
        addingWord={savedDialog.addingWord}
        openedLinkedWord={savedDialog.openedLinkedWord}
        loadingLinkedWord={savedDialog.loadingLinkedWord}
        onClosePendingWordAdd={savedDialog.closePendingWordAdd}
        onConfirmWordAdd={savedDialog.confirmAddWord}
        onCloseOpenedLinkedWord={savedDialog.closeOpenedLinkedWord}
      />
      <FullScreenLoadingOverlay
        loading={saving || savedDialog.isSaving}
        message={saving ? t("content.saving") : t("loading.savingItem")}
      />
    </main>
  );
}
