import { useEffect, useState } from "react";

import { fetchContentItemGrammarExamples } from "../../apiStrategies";
import type { GermanGrammarNounExample, StudyLanguageCode } from "../../types";

export type NounGender = "masculine" | "feminine" | "neuter";

export function useGrammarExamples({
  enabled,
  itemId,
  sourceLanguage,
  targetLanguage,
}: {
  enabled: boolean;
  itemId: number;
  sourceLanguage: StudyLanguageCode;
  targetLanguage: StudyLanguageCode;
}): {
  examples: Partial<Record<NounGender, GermanGrammarNounExample>>;
  isLoading: boolean;
} {
  const [examples, setExamples] = useState<Partial<Record<NounGender, GermanGrammarNounExample>>>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    void fetchContentItemGrammarExamples(itemId, sourceLanguage, targetLanguage)
      .then((response) => {
        if (!cancelled) {
          setExamples(response.examples || {});
        }
      })
      .catch(() => {
        if (!cancelled) {
          setExamples({});
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, itemId, sourceLanguage, targetLanguage]);

  return { examples, isLoading };
}
