import { useEffect, useMemo, useRef, useState } from "react";

import FormattedModelText from "./FormattedModelText";
import { useI18n } from "../i18n";
import type { ItemQuestionExchange } from "../types";

type Props = {
  open: boolean;
  askingQuestion: boolean;
  errorMessage: string;
  itemQuestions: ItemQuestionExchange[];
  sourceLanguageLabel: string;
  sourceText: string;
  targetLanguageLabel: string;
  targetText: string;
  onClose: () => void;
  onAskQuestion: (questionText: string) => Promise<void>;
};

export default function ItemQuestionsModal({
  open,
  askingQuestion,
  errorMessage,
  itemQuestions,
  sourceLanguageLabel,
  sourceText,
  targetLanguageLabel,
  targetText,
  onClose,
  onAskQuestion,
}: Props): JSX.Element | null {
  const { t } = useI18n();
  const [questionInput, setQuestionInput] = useState<string>("");
  const questionsHistoryRef = useRef<HTMLDivElement | null>(null);
  const questionInputRef = useRef<HTMLInputElement | null>(null);

  const orderedItemQuestions = useMemo(
    () => [...itemQuestions].sort((left, right) => left.id - right.id),
    [itemQuestions],
  );
  const quickItemQuestions = useMemo(() => ([
    t("newItem.questionsQuickMeaning"),
    t("newItem.questionsQuickDeconstruct"),
    t("newItem.questionsQuickExamples"),
    t("newItem.questionsQuickMistakes"),
  ]), [t]);

  useEffect(() => {
    if (!open) {
      setQuestionInput("");
      return;
    }
    questionInputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) {
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
  }, [open, orderedItemQuestions, askingQuestion]);

  const submitQuestion = async (questionText: string): Promise<void> => {
    const trimmed = questionText.trim();
    if (askingQuestion || !trimmed) {
      return;
    }
    await onAskQuestion(trimmed);
    setQuestionInput("");
    window.setTimeout(() => {
      questionInputRef.current?.focus({ preventScroll: true });
    }, 0);
  };

  if (!open) {
    return null;
  }

  return (
    <div className="blocking-modal-overlay" role="dialog" aria-modal="true">
      <div className="blocking-modal related-dialogs-modal questions-modal">
        <button type="button" className="modal-corner-close" aria-label={t("newItem.closeRelatedDialogs")} onClick={onClose}>
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
        {!!orderedItemQuestions.length && (
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
                  <div className="item-chat-bubble">
                    <FormattedModelText text={entry.answer_text} />
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
        <form
          className="item-questions-actions"
          onSubmit={(event) => {
            event.preventDefault();
            void submitQuestion(questionInput);
          }}
        >
          <input
            ref={questionInputRef}
            value={questionInput}
            onChange={(event) => setQuestionInput(event.target.value)}
            placeholder={t("newItem.questionsPlaceholder")}
            disabled={askingQuestion}
          />
          <button type="submit" disabled={askingQuestion || !questionInput.trim()}>
            {askingQuestion ? t("newItem.questionsLoading") : t("newItem.questionsAskButton")}
          </button>
        </form>
        <div className="item-question-presets">
          {quickItemQuestions.map((question) => (
            <button
              key={question}
              type="button"
              className="secondary-button item-question-preset"
              disabled={askingQuestion}
              onClick={() => {
                void submitQuestion(question);
              }}
            >
              {question}
            </button>
          ))}
        </div>
        {errorMessage && <p className="error">{errorMessage}</p>}
      </div>
    </div>
  );
}
