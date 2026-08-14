import { useState } from "react";

import { useI18n } from "../../i18n";
import BlockingLoadingOverlay from "../../components/BlockingLoadingOverlay";
import type { ConversationTransport, GoalDifficulty } from "./useConversationTransport";
import { CREATE_NEW_OPTION, RANDOM_TOPIC_OPTION } from "./conversationSetupOptions";
import type { ConversationSetupGoal } from "./useConversationSetup";

function CollapsibleSection({
  title,
  subtitle,
  accent = "neutral",
  disabled = false,
  children,
}: {
  title: string;
  subtitle?: string;
  accent?: "neutral" | "required";
  disabled?: boolean;
  children: JSX.Element | JSX.Element[];
}): JSX.Element {
  const [open, setOpen] = useState<boolean>(false);

  return (
    <section className={`content-collapsible-section content-collapsible-section-${accent}${open ? " content-collapsible-section-open" : ""}`}>
      <button
        type="button"
        className="content-collapsible-trigger"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        disabled={disabled}
      >
        <span className="content-collapsible-trigger-copy conversation-setup-trigger-copy">
          <strong>{title}</strong>
          {!!subtitle && <span className="content-collapsible-trigger-subtitle conversation-setup-trigger-subtitle">{subtitle}</span>}
        </span>
        <span className={`content-collapsible-trigger-icon${open ? " content-collapsible-trigger-icon-open" : ""}`} aria-hidden="true">
          ▾
        </span>
      </button>
      {open && <div className="content-collapsible-body">{children}</div>}
    </section>
  );
}

export default function ConversationSetupCard({
  previousTopics,
  selectedTopic,
  customTopic,
  notes,
  role,
  goalDifficulty,
  selectedConversationMode,
  loadingTopics,
  goal,
  goalGenerating,
  goalError,
  conversationLoading,
  started,
  controlsLocked,
  resolvedTopic,
  onSelectedTopicChange,
  onCustomTopicChange,
  onNotesChange,
  onRoleChange,
  onGoalDifficultyChange,
  onConversationModeChange,
  onGenerateGoal,
  onStart,
}: {
  previousTopics: string[];
  selectedTopic: string;
  customTopic: string;
  notes: string;
  role: string;
  goalDifficulty: GoalDifficulty;
  selectedConversationMode: ConversationTransport;
  loadingTopics: boolean;
  goal: ConversationSetupGoal | null;
  goalGenerating: boolean;
  goalError: string;
  conversationLoading: boolean;
  started: boolean;
  controlsLocked: boolean;
  resolvedTopic: string;
  onSelectedTopicChange: (value: string) => void;
  onCustomTopicChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onRoleChange: (value: string) => void;
  onGoalDifficultyChange: (value: GoalDifficulty) => void;
  onConversationModeChange: (value: ConversationTransport) => void;
  onGenerateGoal: () => void;
  onStart: () => void;
}): JSX.Element {
  const { t } = useI18n();
  const shouldCreateNewTopic = selectedTopic === CREATE_NEW_OPTION;
  const usingRandomTopic = selectedTopic === RANDOM_TOPIC_OPTION;
  const topicSubtitle = usingRandomTopic ? t("content.topic.random") : (resolvedTopic || "");
  const setupSubtitle = [
    notes.trim() ? t("conversation.notesLabel") : "",
    role.trim() ? t("conversation.roleLabel") : "",
  ].filter(Boolean).join(" + ");
  const difficultySubtitle = t(`conversation.goalDifficulty${goalDifficulty.charAt(0).toUpperCase()}${goalDifficulty.slice(1)}` as const);
  const modeSubtitle = selectedConversationMode === "realtime" ? t("conversation.modeLive") : t("conversation.modeNaturalVoices");

  return (
    <div className="content-create-form">
      <CollapsibleSection
        title={t("content.section.topicTitle")}
        subtitle={topicSubtitle}
        accent={!resolvedTopic ? "required" : "neutral"}
        disabled={controlsLocked}
      >
        <div className="content-form-section content-topic-section">
          <select
            id="conversation-topic-select"
            value={selectedTopic}
            onChange={(event) => onSelectedTopicChange(event.target.value)}
            disabled={loadingTopics || conversationLoading || started}
            aria-label={t("content.topic.label")}
            aria-invalid={!resolvedTopic}
          >
            <option value="">{previousTopics.length ? t("content.topic.select") : t("content.topic.none")}</option>
            <option value={RANDOM_TOPIC_OPTION}>{t("content.topic.random")}</option>
            {previousTopics.map((savedTopic) => (
              <option key={savedTopic} value={savedTopic}>{savedTopic}</option>
            ))}
            <option value={CREATE_NEW_OPTION}>{t("content.topic.createNew")}</option>
          </select>
          {usingRandomTopic && <p className="hint">{t("content.topic.randomHint")}</p>}
          {shouldCreateNewTopic && (
            <input
              id="conversation-topic-input"
              value={customTopic}
              onChange={(event) => onCustomTopicChange(event.target.value)}
              placeholder={t("content.topic.placeholder")}
              disabled={conversationLoading || started}
              aria-label={t("content.topic.newLabel")}
              aria-invalid={!resolvedTopic}
            />
          )}
          {!resolvedTopic && <p className="content-required-hint">{t("content.topic.requiredHint")}</p>}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title={t("conversation.setupTitle")}
        subtitle={setupSubtitle}
        disabled={controlsLocked}
      >
        <div className="content-form-section content-setting-block">
          <textarea
            id="conversation-notes"
            className="conversation-notes-input"
            value={notes}
            onChange={(event) => onNotesChange(event.target.value)}
            placeholder={t("conversation.notesPlaceholder")}
            rows={4}
            disabled={conversationLoading || started}
            aria-label={t("conversation.notesLabel")}
          />
          <input
            id="conversation-role"
            type="text"
            className="conversation-role-input"
            value={role}
            onChange={(event) => onRoleChange(event.target.value)}
            placeholder={t("conversation.rolePlaceholder")}
            maxLength={240}
            disabled={conversationLoading || started}
            aria-label={t("conversation.roleLabel")}
          />
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title={t("conversation.goalDifficultyLabel")}
        subtitle={difficultySubtitle}
        disabled={controlsLocked}
      >
        <div className="content-form-section content-setting-block">
          <div className="exercise-audio-mode" role="radiogroup" aria-label={t("conversation.goalDifficultyLabel")}>
            <label className={`exercise-radio-option ${goalDifficulty === "easy" ? "exercise-radio-option-selected" : ""}`}>
              <input
                type="radio"
                name="goal-difficulty"
                checked={goalDifficulty === "easy"}
                onChange={() => onGoalDifficultyChange("easy")}
                disabled={conversationLoading || started}
              />
              <span>{t("conversation.goalDifficultyEasy")}</span>
            </label>
            <label className={`exercise-radio-option ${goalDifficulty === "medium" ? "exercise-radio-option-selected" : ""}`}>
              <input
                type="radio"
                name="goal-difficulty"
                checked={goalDifficulty === "medium"}
                onChange={() => onGoalDifficultyChange("medium")}
                disabled={conversationLoading || started}
              />
              <span>{t("conversation.goalDifficultyMedium")}</span>
            </label>
            <label className={`exercise-radio-option ${goalDifficulty === "hard" ? "exercise-radio-option-selected" : ""}`}>
              <input
                type="radio"
                name="goal-difficulty"
                checked={goalDifficulty === "hard"}
                onChange={() => onGoalDifficultyChange("hard")}
                disabled={conversationLoading || started}
              />
              <span>{t("conversation.goalDifficultyHard")}</span>
            </label>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title={t("conversation.modeLabel")}
        subtitle={modeSubtitle}
        disabled={controlsLocked}
      >
        <div className="content-form-section content-setting-block">
          <div className="exercise-audio-mode" role="radiogroup" aria-label={t("conversation.modeLabel")}>
            <label className={`exercise-radio-option ${selectedConversationMode === "realtime" ? "exercise-radio-option-selected" : ""}`}>
              <input
                type="radio"
                name="conversation-mode"
                checked={selectedConversationMode === "realtime"}
                onChange={() => onConversationModeChange("realtime")}
                disabled={conversationLoading || started}
              />
              <span>{t("conversation.modeLive")}</span>
            </label>
            <label className={`exercise-radio-option ${selectedConversationMode === "http" ? "exercise-radio-option-selected" : ""}`}>
              <input
                type="radio"
                name="conversation-mode"
                checked={selectedConversationMode === "http"}
                onChange={() => onConversationModeChange("http")}
                disabled={conversationLoading || started}
              />
              <span>{t("conversation.modeNaturalVoices")}</span>
            </label>
          </div>
        </div>
      </CollapsibleSection>

      {!started && (
        <div className="actions">
          <BlockingLoadingOverlay loading={goalGenerating} message={t("conversation.goalRegenerating")}>
            <div className="conversation-setup-goal">
              <p className="conversation-goal-banner-label">{t("conversation.goalLabel")}</p>
              {goal ? (
                <>
                  <p className="conversation-goal-banner-text">{goal.text}</p>
                  {usingRandomTopic && <p className="hint">{goal.topic}</p>}
                </>
              ) : (
                <p className="hint">{t("conversation.goalRequired")}</p>
              )}
              {goalError && <p className="error">{goalError}</p>}
              <button
                type="button"
                className="secondary-button"
                onClick={onGenerateGoal}
                disabled={conversationLoading || goalGenerating || loadingTopics || !resolvedTopic}
              >
                {goalGenerating
                  ? t("conversation.goalRegenerating")
                  : goal ? t("conversation.goalRegenerate") : t("conversation.goalGenerate")}
              </button>
            </div>
          </BlockingLoadingOverlay>
          <button
            type="button"
            onClick={onStart}
            disabled={conversationLoading || goalGenerating || loadingTopics || !goal}
          >
            {conversationLoading ? t("conversation.starting") : t("conversation.start")}
          </button>
        </div>
      )}
    </div>
  );
}
