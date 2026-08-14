import { useState } from "react";

import { processPhraseGrammarPoolCandidate } from "../apiGrammarPool";
import { useI18n } from "../i18n";
import type { StudyLanguageCode } from "../studyLanguages";

const BATCH_SIZE = 10;

export default function ConfigurationGrammarPoolSection({
  canManage,
  sourceLanguage,
  targetLanguage,
}: {
  canManage: boolean;
  sourceLanguage: StudyLanguageCode;
  targetLanguage: StudyLanguageCode;
}): JSX.Element | null {
  const { t } = useI18n();
  const [isBuilding, setIsBuilding] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [featureCount, setFeatureCount] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  if (!canManage) return null;

  const buildPool = async (): Promise<void> => {
    setIsBuilding(true);
    setProcessedCount(0);
    setFeatureCount(0);
    setMessage("");
    setError("");
    let processed = 0;
    let features = 0;
    try {
      for (let index = 0; index < BATCH_SIZE; index += 1) {
        const result = await processPhraseGrammarPoolCandidate(sourceLanguage, targetLanguage);
        if (result.status === "empty") break;
        processed += 1;
        features += result.feature_keys?.length || 0;
        setProcessedCount(processed);
        setFeatureCount(features);
      }
      setMessage(processed
        ? t("config.grammarPoolComplete", { count: processed, features })
        : t("config.grammarPoolEmpty"));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t("config.grammarPoolFailed"));
    } finally {
      setIsBuilding(false);
    }
  };

  return (
    <section className="card settings-card">
      <h2 className="settings-title">{t("config.grammarPoolTitle")}</h2>
      <p className="settings-subtitle">{t("config.grammarPoolSubtitle")}</p>
      <div className="actions">
        <button type="button" onClick={() => void buildPool()} disabled={isBuilding}>
          {isBuilding
            ? t("config.grammarPoolBuilding", { processed: processedCount, total: BATCH_SIZE })
            : t("config.grammarPoolBuild")}
        </button>
      </div>
      {message ? <p className="hint">{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}
