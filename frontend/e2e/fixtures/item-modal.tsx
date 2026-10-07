import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import LegacyItemView from "../../src/components/LegacyItemView";
import DialogTurnText from "../../src/components/DialogTurnText";
import RevealedReviewSummary from "../../src/components/RevealedReviewSummary";
import DialogItemSavingModals from "../../src/features/dialogs/components/DialogItemSavingModals";
import { I18nProvider } from "../../src/i18n";
import type { SessionItem } from "../../src/types";
import "../../src/styles.css";
import "../../src/accessibility/modals.css";
import "../../src/accessibility/studyText.css";
import { installVisualViewportSizing } from "../../src/accessibility/visualViewport";
import { StudyTextSizeProvider } from "../../src/accessibility/StudyTextSizeProvider";
import StudyTextSizeSetting from "../../src/accessibility/StudyTextSizeSetting";

installVisualViewportSizing();

const item: SessionItem = {
  id: 71, item_type: "word", mode: "new", word_type: "adjective",
  german_text: "klein", spanish_text: "small", options: [],
  notes: "A useful example sentence. ".repeat(150),
};

function Fixture() {
  const [open, setOpen] = useState(false);
  return <I18nProvider>
    <button onClick={() => setOpen(true)}>Open item</button>
    <DialogTurnText dialogId={1} turnIndex={0} targetText="Das ist klein."
      sourceText="That is small." sourceLanguage="english" targetLanguage="german"
      showPhraseSelection={false} onTokenClick={() => setOpen(true)} />
    <StudyTextSizeSetting />
    <section data-testid="readonly-dialog">
      <DialogTurnText dialogId={2} turnIndex={0} targetText="Guten Tag."
        sourceText="Good day." sourceLanguage="english" targetLanguage="german"
        disableWordClicks showPhraseSelection={false} />
    </section>
    <section data-testid="audio-only-dialog">
      <DialogTurnText dialogId={3} turnIndex={0} targetText="Danke."
        sourceText="Thank you." sourceLanguage="english" targetLanguage="german"
        hideTargetText showPhraseSelection={false} />
    </section>
    <section data-testid="revealed-answer">
      <RevealedReviewSummary itemId={72} answer="Hello" phrase="Hallo!" phraseTranslation="Hello!" />
    </section>
    <DialogItemSavingModals pendingWordAdd={null} addingWord={false}
      onCancelWordAdd={() => {}} onConfirmWordAdd={() => {}}
      openedItemContent={open ? <LegacyItemView item={item} readOnly onClose={() => setOpen(false)} /> : null} />
  </I18nProvider>;
}

createRoot(document.getElementById("root")!).render(<StudyTextSizeProvider><Fixture /></StudyTextSizeProvider>);
