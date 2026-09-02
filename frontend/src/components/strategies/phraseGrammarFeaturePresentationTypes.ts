import type { ReactNode } from "react";

import type { MessageKey } from "../../i18n";
import type { PhraseGrammarFeatureKey } from "./phraseGrammarTypes";

export type PhraseGrammarFeaturePresentation = {
  title: MessageKey;
  present: MessageKey;
  example: ReactNode;
};

export type PhraseGrammarFeaturePresentationMap = Partial<Record<PhraseGrammarFeatureKey, PhraseGrammarFeaturePresentation>>;
