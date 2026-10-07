import { useEffect, useState } from "react";

import { useI18n } from "../i18n";
import DialogActionIcon from "./DialogActionIcon";
import InteractiveTargetPhrase from "./InteractiveTargetPhrase";

interface RevealedReviewSummaryProps {
  itemId: number;
  answer: string;
  phrase?: string;
  phraseTranslation?: string;
  fallbackPhrase?: string;
  audioOnly?: boolean;
  showReplayAudio?: boolean;
  onReplayAudio?: (() => void | Promise<unknown>) | undefined;
}

export default function RevealedReviewSummary({
  itemId,
  answer,
  phrase,
  phraseTranslation,
  fallbackPhrase,
  audioOnly = false,
  showReplayAudio = false,
  onReplayAudio,
}: RevealedReviewSummaryProps): JSX.Element {
  const { t } = useI18n();
  const targetText = phrase || fallbackPhrase || answer;
  const canHidePhraseText = audioOnly && Boolean(onReplayAudio);
  const showAudioControls = Boolean(onReplayAudio) && (canHidePhraseText || showReplayAudio);
  const [showPhraseText, setShowPhraseText] = useState(!canHidePhraseText);

  useEffect(() => {
    setShowPhraseText(!canHidePhraseText);
  }, [canHidePhraseText, itemId, targetText]);

  return (
    <div className="revealed-answer">
      <p className="revealed-answer-main">{answer}</p>
      {showAudioControls && (
        <div className="revealed-answer-phrase-row">
          <button
            type="button"
            className="secondary-button revealed-answer-icon-button"
            onClick={() => void onReplayAudio?.()}
            aria-label={t("prompt.replayAudio")}
            title={t("prompt.replayAudio")}
          >
            <DialogActionIcon name="play" />
          </button>
            <InteractiveTargetPhrase
              key={`${itemId}-${targetText}`}
              className="conversation-line conversation-line-translation revealed-answer-phrase"
              sourceText={phraseTranslation || ""}
              targetText={targetText}
              statusKeyPrefix={`review-${itemId}-phrase`}
              hideTargetText={canHidePhraseText && !showPhraseText}
              allowPhraseSaving={Boolean(phrase || fallbackPhrase)}
            />
          {canHidePhraseText && (
            <button
              type="button"
              className="secondary-button revealed-answer-icon-button"
              onClick={() => setShowPhraseText((current) => !current)}
              aria-label={showPhraseText ? t("prompt.hideText") : t("prompt.showText")}
              title={showPhraseText ? t("prompt.hideText") : t("prompt.showText")}
            >
              <DialogActionIcon name="text" />
            </button>
          )}
        </div>
      )}
      {!showAudioControls && (
        <InteractiveTargetPhrase
          key={`${itemId}-${targetText}`}
          className="conversation-line conversation-line-translation revealed-answer-phrase"
          sourceText={phraseTranslation || ""}
          targetText={targetText}
          statusKeyPrefix={`review-${itemId}-phrase`}
          allowPhraseSaving={Boolean(phrase || fallbackPhrase)}
        />
      )}
    </div>
  );
}
