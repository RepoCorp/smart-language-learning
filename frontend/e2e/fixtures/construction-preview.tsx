import { useState } from "react";
import { createRoot } from "react-dom/client";
import { I18nProvider } from "../../src/i18n";
import WordAddConfirmation from "../../src/features/dialogs/components/WordAddConfirmation";
import { wordAddPreview } from "../../src/features/dialogs/components/wordAddPreview";
import "../../src/styles.css";

function Fixture() {
  const [open, setOpen] = useState(true);
  const affix = new URLSearchParams(location.search).has("affix");
  return <I18nProvider>
    {open ? <WordAddConfirmation saving={false} onCancel={() => setOpen(false)}
      onConfirm={() => { if (affix) setOpen(false); else throw new Error("A construction preview must not save"); }}
      item={affix ? { target: "die Möglichkeit", source: "la posibilidad", wordType: "noun" } : wordAddPreview({
        created: false, exists: false, item_type: "pattern",
        construction_pattern: {
          key: "future_with_werden", form: "werden + Infinitiv", meaning: "Hablar de una acción futura",
          explanation: "Aquí wird acompaña a kommen para hablar de algo que ocurrirá después.",
          example: "Er wird morgen kommen.", matched_parts: ["wird", "kommen"], replaces_word: true, save_token: "signed-preview",
        },
      })} /> : <p>Closed preview</p>}
  </I18nProvider>;
}

createRoot(document.getElementById("root")!).render(<Fixture />);
