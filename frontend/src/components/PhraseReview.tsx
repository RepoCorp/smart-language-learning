import { useEffect, useMemo, useState } from "react";

import { shouldAutoplayPrompt } from "../audioAutoplayGuard";
import { useI18n } from "../i18n";
import { usePromptPreferences } from "../promptPreferences";
import { type StudyLanguageCode, useStudyLanguages } from "../studyLanguages";
import type { SessionItem } from "../types";
import DangerousButton from "./DangerousButton";

interface PhraseReviewProps {
  item: SessionItem;
  onAnswered: (correct: boolean) => Promise<void>;
  onOpenItem?: (itemId: number) => void;
}

const FEEDBACK_DELAY_MS = 2000;

type PhraseToken = {
  id: string;
  text: string;
  originalIndex: number;
};

function phraseTokens(value: string): PhraseToken[] {
  return value
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .map((part, index) => ({
      id: `${index}-${part}`,
      text: part,
      originalIndex: index,
    }));
}

function hashToken(value: string): number {
  return value.split("").reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0);
}

function shufflePhraseTokens(tokens: PhraseToken[], seed: number): PhraseToken[] {
  if (tokens.length < 2) {
    return tokens;
  }
  const shuffled = [...tokens].sort((left, right) => {
    const leftHash = hashToken(`${seed}:${left.id}:${left.text}`);
    const rightHash = hashToken(`${seed}:${right.id}:${right.text}`);
    return leftHash - rightHash;
  });
  const keptOriginalOrder = shuffled.every((token, index) => token.originalIndex === index);
  return keptOriginalOrder ? [...shuffled].reverse() : shuffled;
}

export default function PhraseReview({ item, onAnswered, onOpenItem }: PhraseReviewProps): JSX.Element {
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
  const [feedback, setFeedback] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showPromptText, setShowPromptText] = useState<boolean>(targetPromptMode === "text");
  const [answerRevealed, setAnswerRevealed] = useState<boolean>(false);
  const [placedPhraseTokens, setPlacedPhraseTokens] = useState<PhraseToken[]>([]);
  const [wrongPhraseTokenId, setWrongPhraseTokenId] = useState<string>("");
  const [phraseBuilderComplete, setPhraseBuilderComplete] = useState<boolean>(false);
  const isSpanishToGerman = item.direction !== "de_to_es";
  const allowPromptAudio = !isSpanishToGerman;
  const promptText = isSpanishToGerman ? item.spanish_text : item.german_text;
  const expectedAnswer = isSpanishToGerman ? item.german_text : item.spanish_text;
  const expectedPhraseTokens = useMemo(() => phraseTokens(expectedAnswer), [expectedAnswer]);
  const phraseBuilderTokens = useMemo(() => shufflePhraseTokens(expectedPhraseTokens, item.id), [expectedPhraseTokens, item.id]);
  const languageLabel = isSpanishToGerman
    ? t(languageKeyByCode[targetLanguage])
    : t(languageKeyByCode[sourceLanguage]);
  const hidePromptText = targetPromptMode === "audio" && allowPromptAudio && !showPromptText;
  const useRepeatPlaceholder = Boolean(item.repeatedAfterFailure);

  const playPromptAudio = (): void => {
    if (!allowPromptAudio || !item.audio_url) {
      return;
    }
    const audio = new Audio(item.audio_url);
    void audio.play().catch(() => {});
  };

  const submitWithFeedback = async (correct: boolean, message: string): Promise<void> => {
    if (isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    setFeedback(message);
    try {
      await new Promise((resolve) => setTimeout(resolve, FEEDBACK_DELAY_MS));
      await onAnswered(correct);
    } finally {
      setIsSubmitting(false);
    }
  };

  const markSelfGradedAnswer = async (correct: boolean): Promise<void> => {
    if (isSubmitting || !answerRevealed) {
      return;
    }
    await submitWithFeedback(correct, correct ? t("phrase.feedback.correct") : t("phrase.feedback.markedWrong", { answer: expectedAnswer }));
  };

  const handlePhraseBuilderToken = (token: PhraseToken): void => {
    if (isSubmitting || phraseBuilderComplete) {
      return;
    }
    const expectedToken = expectedPhraseTokens[placedPhraseTokens.length];
    if (!expectedToken || token.text !== expectedToken.text) {
      setWrongPhraseTokenId(token.id);
      window.setTimeout(() => setWrongPhraseTokenId((current) => (current === token.id ? "" : current)), 450);
      return;
    }
    const nextPlacedTokens = [...placedPhraseTokens, token];
    setPlacedPhraseTokens(nextPlacedTokens);
    setWrongPhraseTokenId("");
    if (nextPlacedTokens.length === expectedPhraseTokens.length) {
      setPhraseBuilderComplete(true);
    }
  };

  useEffect(() => {
    setShowPromptText(targetPromptMode === "text");
  }, [targetPromptMode]);

  useEffect(() => {
    setFeedback("");
    setAnswerRevealed(false);
    setPlacedPhraseTokens([]);
    setWrongPhraseTokenId("");
    setPhraseBuilderComplete(false);
  }, [item.id, item.direction]);

  useEffect(() => {
    if (targetPromptMode !== "audio") {
      return;
    }
    if (!allowPromptAudio) {
      return;
    }
    const autoplayKey = `phrase:${item.id}:${item.audio_url || ""}:${targetPromptMode}`;
    if (!shouldAutoplayPrompt(autoplayKey)) {
      return;
    }
    playPromptAudio();
  }, [targetPromptMode, item.id, item.audio_url, allowPromptAudio]);

  if (useRepeatPlaceholder) {
    const placedIds = new Set(placedPhraseTokens.map((token) => token.id));
    const remainingTokens = phraseBuilderTokens.filter((token) => !placedIds.has(token.id));
    return (
      <div>
        <p className="prompt">{t("phrase.builderPrompt", { language: languageLabel, text: promptText })}</p>
        <div className="phrase-builder-slots" aria-label={t("phrase.builderAnswerLabel")}>
          {expectedPhraseTokens.map((token, index) => (
            <span key={token.id} className={`phrase-builder-slot${placedPhraseTokens[index] ? " phrase-builder-slot-filled" : ""}`}>
              {placedPhraseTokens[index]?.text || "\u00a0"}
            </span>
          ))}
        </div>
        <div className="phrase-builder-bank" aria-label={t("phrase.builderBankLabel")}>
          {remainingTokens.map((token) => (
            <button
              key={token.id}
              type="button"
              className={`phrase-builder-token${wrongPhraseTokenId === token.id ? " phrase-builder-token-wrong" : ""}`}
              onClick={() => handlePhraseBuilderToken(token)}
              disabled={isSubmitting || phraseBuilderComplete}
            >
              {token.text}
            </button>
          ))}
        </div>
        {phraseBuilderComplete && <p className="phrase-builder-success">{t("phrase.builderComplete")}</p>}
        <div className="actions">
          {onOpenItem ? (
            <button type="button" className="secondary-button" onClick={() => onOpenItem(item.id)}>
              {t("words.openItem")}
            </button>
          ) : null}
          {phraseBuilderComplete && (
            <button type="button" onClick={() => void onAnswered(true)} disabled={isSubmitting}>
              {t("review.continue")}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      {targetPromptMode === "audio" && allowPromptAudio && (
        <div className="prompt-visibility-controls">
          <button type="button" className="secondary-button" onClick={() => setShowPromptText((value) => !value)}>
            {showPromptText ? t("prompt.hideText") : t("prompt.showText")}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={playPromptAudio}
            disabled={!allowPromptAudio || !item.audio_url}
          >
            {t("prompt.playAudio")}
          </button>
        </div>
      )}
      {hidePromptText ? (
        <p className="prompt prompt-audio-placeholder">{t("prompt.audioOnly")}</p>
      ) : (
        <p className="prompt">{t("phrase.prompt", { language: languageLabel, text: promptText })}</p>
      )}
      {answerRevealed && (
        <p className="revealed-answer">
          <span>{t("review.answerLabel")}</span> {expectedAnswer}
        </p>
      )}
      <div className="actions">
        {!answerRevealed ? (
          <>
            {onOpenItem ? (
              <button type="button" className="secondary-button" onClick={() => onOpenItem(item.id)}>
                {t("words.openItem")}
              </button>
            ) : null}
            <button type="button" onClick={() => setAnswerRevealed(true)} disabled={isSubmitting}>
              {t("review.revealAnswer")}
            </button>
          </>
        ) : (
          <>
            {onOpenItem ? (
              <button type="button" className="secondary-button" onClick={() => onOpenItem(item.id)}>
                {t("words.openItem")}
              </button>
            ) : null}
            <button type="button" className="item-got-it-button" onClick={() => void markSelfGradedAnswer(true)} disabled={isSubmitting}>
              {t("review.passed")}
            </button>
            <DangerousButton className="dangerous-primary-button" onConfirm={() => markSelfGradedAnswer(false)} disabled={isSubmitting}>
              {t("review.failed")}
            </DangerousButton>
          </>
        )}
      </div>
      {feedback && <p>{feedback}</p>}
    </div>
  );
}
