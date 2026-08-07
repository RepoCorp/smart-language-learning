import { useState } from "react";

import { useI18n } from "../../i18n";

const CREATE_NEW_OPTION = "__create_new__";
const RANDOM_TOPIC_OPTION = "__random_topic__";

type DialogLength = "standard" | "short_three";
type RequiredWordsLanguage = "source" | "target";
type ProficiencyLevel = "A1" | "A2" | "B1" | "B2";

function CollapsibleSection({
  title,
  subtitle,
  defaultOpen,
  children,
  accent = "neutral",
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: JSX.Element | JSX.Element[];
  accent?: "neutral" | "required";
}): JSX.Element {
  const [open, setOpen] = useState<boolean>(Boolean(defaultOpen));

  return (
    <section className={`content-collapsible-section content-collapsible-section-${accent}${open ? " content-collapsible-section-open" : ""}`}>
      <button
        type="button"
        className="content-collapsible-trigger"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="content-collapsible-trigger-copy">
          <strong>{title}</strong>
          {!!subtitle && <span className="content-collapsible-trigger-subtitle">{subtitle}</span>}
        </span>
        <span className={`content-collapsible-trigger-icon${open ? " content-collapsible-trigger-icon-open" : ""}`} aria-hidden="true">
          ▾
        </span>
      </button>
      {open && <div className="content-collapsible-body">{children}</div>}
    </section>
  );
}

export default function ContentCreateFormCard({
  selectedTopic,
  customTopic,
  selectedContext,
  customContext,
  conversationDetails,
  requiredWords,
  requiredWordsLanguage,
  dialogLength,
  proficiencyLevel,
  previousTopics,
  previousContexts,
  loading,
  saving,
  resolvedTopic,
  onSelectedTopicChange,
  onCustomTopicChange,
  onSelectedContextChange,
  onCustomContextChange,
  onConversationDetailsChange,
  onRequiredWordsChange,
  onRequiredWordsLanguageChange,
  onDialogLengthChange,
  onProficiencyLevelChange,
  onGeneratePreview,
}: {
  selectedTopic: string;
  customTopic: string;
  selectedContext: string;
  customContext: string;
  conversationDetails: string;
  requiredWords: string;
  requiredWordsLanguage: RequiredWordsLanguage;
  dialogLength: DialogLength;
  proficiencyLevel: ProficiencyLevel;
  previousTopics: string[];
  previousContexts: string[];
  loading: boolean;
  saving: boolean;
  resolvedTopic: string;
  onSelectedTopicChange: (value: string) => void;
  onCustomTopicChange: (value: string) => void;
  onSelectedContextChange: (value: string) => void;
  onCustomContextChange: (value: string) => void;
  onConversationDetailsChange: (value: string) => void;
  onRequiredWordsChange: (value: string) => void;
  onRequiredWordsLanguageChange: (value: RequiredWordsLanguage) => void;
  onDialogLengthChange: (value: DialogLength) => void;
  onProficiencyLevelChange: (value: ProficiencyLevel) => void;
  onGeneratePreview: () => void;
}): JSX.Element {
  const { t } = useI18n();
  const shouldCreateNewTopic = selectedTopic === CREATE_NEW_OPTION;
  const shouldCreateNewContext = selectedContext === CREATE_NEW_OPTION;
  const usingRandomTopic = selectedTopic === RANDOM_TOPIC_OPTION;
  const hasRequiredWords = requiredWords.trim().length > 0;
  const hasCustomTopicText = customTopic.trim().length > 0;
  const needsCustomTopic = shouldCreateNewTopic && !hasCustomTopicText;

  return (
    <section className="card content-create-form">
      <CollapsibleSection
        title={t("content.section.topicTitle")}
        subtitle={needsCustomTopic
          ? t("content.topic.requiredBadge")
          : (usingRandomTopic ? t("content.topic.random") : (resolvedTopic ? resolvedTopic : t("content.section.topicSubtitleEmpty")))}
        accent={needsCustomTopic ? "required" : "neutral"}
      >
        <div className="content-form-section content-topic-section">
          <select
            id="topic-select"
            value={selectedTopic}
            onChange={(e) => onSelectedTopicChange(e.target.value)}
            disabled={loading || saving}
            aria-label={t("content.section.topicTitle")}
          >
            <option value={RANDOM_TOPIC_OPTION}>{t("content.topic.random")}</option>
            {previousTopics.map((savedTopic) => (
              <option key={savedTopic} value={savedTopic}>
                {savedTopic}
              </option>
            ))}
            <option value={CREATE_NEW_OPTION}>{t("content.topic.createNew")}</option>
          </select>
          {shouldCreateNewTopic && (
            <>
              <label htmlFor="topic-input" className="prompt">{t("content.topic.newLabel")}</label>
              <input
                id="topic-input"
                value={customTopic}
                onChange={(e) => onCustomTopicChange(e.target.value)}
                placeholder={t("content.topic.placeholder")}
                disabled={loading || saving}
                required
                aria-invalid={!hasCustomTopicText}
                style={needsCustomTopic ? {
                  border: "2px solid #b42318",
                  background: "#fff1f0",
                  boxShadow: "0 0 0 1px rgba(180, 35, 24, 0.16)",
                } : undefined}
              />
              <p className="error" hidden={hasCustomTopicText}>{t("content.topic.requiredBadge")}</p>
            </>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title={t("content.section.contextTitle")}
        subtitle={selectedContext === CREATE_NEW_OPTION ? customContext.trim() || t("content.context.none") : selectedContext || t("content.context.none")}
      >
        <div className="content-form-section">
          <select
            id="topic-context-select"
            value={selectedContext}
            onChange={(e) => onSelectedContextChange(e.target.value)}
            disabled={loading || saving}
            aria-label={t("content.section.contextTitle")}
          >
            <option value="">{t("content.context.none")}</option>
            {previousContexts.map((savedContext) => (
              <option key={savedContext} value={savedContext}>
                {savedContext}
              </option>
            ))}
            <option value={CREATE_NEW_OPTION}>{t("content.context.createNew")}</option>
          </select>
          {shouldCreateNewContext && (
            <>
              <input
                id="topic-context-input"
                value={customContext}
                onChange={(e) => onCustomContextChange(e.target.value)}
              placeholder={t("content.context.placeholder")}
              disabled={loading || saving}
            />
            </>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title={t("content.section.optionsTitle")}
      >
        <>
          <div className="content-form-section content-setting-block">
            <div className="content-setting-block-copy">
              <p className="content-form-section-title">{t("content.level.label")}</p>
            </div>
            <div className="content-radio-options" role="radiogroup" aria-label={t("content.level.label")}>
              {(["A1", "A2", "B1", "B2"] as ProficiencyLevel[]).map((level) => (
                <label key={level} className={`content-radio-option${proficiencyLevel === level ? " content-radio-option-selected" : ""}`}>
                  <input
                    type="radio"
                    name="content-proficiency-level"
                    value={level}
                    checked={proficiencyLevel === level}
                    onChange={() => onProficiencyLevelChange(level)}
                    disabled={loading || saving}
                  />
                  {level}
                </label>
              ))}
            </div>
          </div>
          <div className="content-form-section content-setting-block">
            <div className="content-setting-block-copy">
              <p className="content-form-section-title">{t("content.length.label")}</p>
            </div>
            <div className="content-radio-options" role="radiogroup" aria-label={t("content.length.label")}>
              {(["standard", "short_three"] as DialogLength[]).map((length) => (
                <label
                  key={length}
                  className={`content-radio-option${dialogLength === length ? " content-radio-option-selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="dialog-length"
                    value={length}
                    checked={dialogLength === length}
                    onChange={() => onDialogLengthChange(length)}
                    disabled={loading || saving}
                  />
                  {length === "standard" ? t("content.length.standard") : t("content.length.shortThree")}
                </label>
              ))}
            </div>
          </div>
          <div className="content-form-section content-setting-block">
            <div className="content-setting-block-copy">
              <p className="content-form-section-title">{t("content.requiredWords.label")}</p>
            </div>
            <input
              id="required-words-input"
              value={requiredWords}
              onChange={(e) => onRequiredWordsChange(e.target.value)}
              placeholder={t("content.requiredWords.placeholder")}
              disabled={loading || saving}
            />
            <div className="content-radio-options" role="radiogroup" aria-label={t("content.requiredWords.label")}>
              {(["target", "source"] as RequiredWordsLanguage[]).map((language) => (
                <label
                  key={language}
                  className={`content-radio-option${hasRequiredWords && requiredWordsLanguage === language ? " content-radio-option-selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="required-words-language"
                    value={language}
                    checked={hasRequiredWords && requiredWordsLanguage === language}
                    onChange={() => onRequiredWordsLanguageChange(language)}
                    disabled={loading || saving || !hasRequiredWords}
                  />
                  {language === "target" ? t("content.requiredWords.languageTarget") : t("content.requiredWords.languageSource")}
                </label>
              ))}
            </div>
          </div>
          <div className="content-form-section content-setting-block">
            <div className="content-setting-block-copy">
              <p className="content-form-section-title">{t("content.details.label")}</p>
              <p className="hint">{t("content.details.description")}</p>
            </div>
            <textarea
              id="conversation-details-input"
              value={conversationDetails}
              onChange={(e) => onConversationDetailsChange(e.target.value)}
              placeholder={t("content.details.placeholder")}
              disabled={loading || saving}
              rows={4}
            />
            <p className="hint">{t("content.details.hint")}</p>
          </div>
        </>
      </CollapsibleSection>

      <div className="actions">
        <button onClick={onGeneratePreview} disabled={loading || saving || !resolvedTopic}>
          {loading ? t("content.generating") : t("content.generate")}
        </button>
      </div>
    </section>
  );
}
