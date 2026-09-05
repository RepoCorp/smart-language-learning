import { useCallback, useState, type FormEvent } from "react";

import { useI18n } from "../i18n";
import { useStudyLanguages } from "../studyLanguages";
import { notifyGuidedTourAction } from "../guides/guidedTourEvents";
import DangerousButton from "./DangerousButton";
import SessionCurrentItem from "./session/SessionCurrentItem";
import SessionPageOverlays from "./session/SessionPageOverlays";
import SessionStartCard from "./session/SessionStartCard";
import useSessionItemModal from "./session/useSessionItemModal";
import useSessionReviewFlow from "./session/useSessionReviewFlow";
import { useNewItemCelebration } from "./useNewItemCelebration";
import useSessionStudyActivity from "./useSessionStudyActivity";
import { useSessionItemPayloads } from "../features/session/useSessionItemPayloads";
import { useSessionLifecycle } from "../features/session/useSessionLifecycle";

export default function SessionPage(): JSX.Element {
  const { t } = useI18n();
  const { sourceLanguage, targetLanguage } = useStudyLanguages();
  const {
    items,
    setItems,
    loading,
    error,
    setError,
    durationInput,
    setDurationInput,
    sessionDurationMinutes,
    setSessionDurationMinutes,
    sessionEndsAtMs,
    setSessionEndsAtMs,
    remainingSeconds,
    setRemainingSeconds,
    sessionOutcome,
    setSessionOutcome,
    index,
    setIndex,
    showPostReviewItem,
    setShowPostReviewItem,
    setCurrentReviewCorrect,
    showExtendPrompt,
    setShowExtendPrompt,
    sessionPlanToken,
    loadSession,
  } = useSessionLifecycle({ sourceLanguage, targetLanguage });
  const removeUnavailableItem = useCallback((unavailableItem: typeof items[number]): void => {
    setItems((currentItems) => currentItems.filter((entry) => (
      entry.id !== unavailableItem.id
      || entry.mode !== unavailableItem.mode
      || entry.direction !== unavailableItem.direction
      || entry.repeatPracticeStep !== unavailableItem.repeatPracticeStep
      || Boolean(entry.repeatedAfterFailure) !== Boolean(unavailableItem.repeatedAfterFailure)
    )));
    setIndex((currentIndex) => (
      currentIndex >= items.length - 1 ? Math.max(0, currentIndex - 1) : currentIndex
    ));
    setShowPostReviewItem(false);
    setCurrentReviewCorrect(null);
  }, [items.length, setCurrentReviewCorrect, setIndex, setItems, setShowPostReviewItem]);
  const {
    showNewItemCelebration,
    registerConfirmedNewItem,
    dismissNewItemCelebration,
  } = useNewItemCelebration();
  const {
    currentItem: current,
    currentItemLoading,
    currentItemError,
  } = useSessionItemPayloads({
    entries: items,
    index,
    sourceLanguage,
    targetLanguage,
    planToken: sessionPlanToken,
    onItemUnavailable: removeUnavailableItem,
  });

  useSessionStudyActivity(
    sessionDurationMinutes !== null
      && sessionOutcome === null
      && !showExtendPrompt
      && !loading
      && items.length > 0,
    sourceLanguage,
    targetLanguage,
  );

  const reviewFlow = useSessionReviewFlow({
    current, items, index, sessionOutcome, showExtendPrompt, showPostReviewItem,
    setItems, setIndex, setSessionOutcome, setShowPostReviewItem, setCurrentReviewCorrect,
    onNewItemConfirmed: registerConfirmedNewItem,
    resetErrorMessage: t("session.resetCurrentResultFailed"),
  });
  const itemModal = useSessionItemModal(sourceLanguage, targetLanguage, t("manage.error.load"));
  const {
    waitingNext,
    resetCurrentResultError,
    resettingCurrentResult,
    currentReviewResetVersion,
    register,
    registerSeenItem,
    continueAfterReviewedItem,
    resetCurrentResult,
  } = reviewFlow;
  const {
    openedItem,
    loadingOpenedItem,
    openedItemError,
    openItemModal,
    closeItemModal,
  } = itemModal;

  const startSession = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const parsed = Number.parseInt(durationInput, 10);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 180) {
      setError(t("session.durationInvalid"));
      return;
    }
    setError("");
    setSessionOutcome(null);
    setShowExtendPrompt(false);
    setShowPostReviewItem(false);
    setCurrentReviewCorrect(null);
    setRemainingSeconds(parsed * 60);
    setSessionEndsAtMs(Date.now() + parsed * 60 * 1000);
    setSessionDurationMinutes(parsed);
    void loadSession(parsed);
    notifyGuidedTourAction("session-started");
  };

  const resetToSessionStart = (): void => {
    setSessionDurationMinutes(null);
    setSessionEndsAtMs(null);
    setSessionOutcome(null);
    setShowExtendPrompt(false);
    setRemainingSeconds(0);
    setItems([]);
    setIndex(0);
    setError("");
    setResetCurrentResultError("");
    setShowPostReviewItem(false);
    setCurrentReviewCorrect(null);
    reviewFlow.resetFlow();
  };

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedRemaining = `${minutes}:${String(seconds).padStart(2, "0")}`;

  const overlays = (
    <SessionPageOverlays
      openedItem={openedItem}
      loadingOpenedItem={loadingOpenedItem}
      openedItemError={openedItemError}
      onCloseItem={closeItemModal}
      showNewItemCelebration={showNewItemCelebration}
      onDismissCelebration={dismissNewItemCelebration}
    />
  );

  if (sessionDurationMinutes === null) {
    return <SessionStartCard durationInput={durationInput} error={error} onDurationChange={setDurationInput} onStart={startSession} />;
  }

  if (sessionOutcome !== null) {
    return (
      <>
        <main className="container">
          <h1>{t("session.title")}</h1>
          <section className="card">
            {sessionOutcome === "time_up" ? (
              <>
                <p className="error">{t("session.timeUpTitle")}</p>
                <p>{t("session.timeUpMessage")}</p>
              </>
            ) : (
              <>
                <p>{t("session.completedTitle")}</p>
                <p>{t("session.completedMessage")}</p>
              </>
            )}
            {resetCurrentResultError && <p className="error">{t("session.error", { message: resetCurrentResultError })}</p>}
            <div className="actions">
              <button onClick={resetToSessionStart}>{t("session.startAnother")}</button>
            </div>
          </section>
        </main>
        {overlays}
      </>
    );
  }

  if (loading || (items.length > 0 && currentItemLoading)) {
    return (
      <>
        <main className="container">{t("session.loading")}</main>
        {overlays}
      </>
    );
  }

  if (error || currentItemError) {
    return (
      <>
        <main className="container">
          <p className="error">{t("session.error", { message: error || currentItemError })}</p>
          <div className="actions">
            <DangerousButton className="secondary-button dangerous-action-button" onConfirm={resetToSessionStart}>
              {t("session.restart")}
            </DangerousButton>
          </div>
        </main>
        {overlays}
      </>
    );
  }

  if (!items.length) {
    return (
      <>
        <main className="container">
          <p>{t("session.empty")}</p>
          <div className="actions">
            <DangerousButton className="secondary-button dangerous-action-button" onConfirm={resetToSessionStart}>
              {t("session.restart")}
            </DangerousButton>
          </div>
        </main>
        {overlays}
      </>
    );
  }

  if (!current) {
    return (
      <>
        <main className="container">{t("session.loading")}</main>
        {overlays}
      </>
    );
  }

  const currentRenderKey = [
    current.id,
    current.mode,
    current.direction || "none",
    current.repeatPracticeStep || "base",
    current.repeatedAfterFailure ? "retry" : "fresh",
    index,
    currentReviewResetVersion,
  ].join(":");

      return (
        <>
          <main className="container" data-testid="session-page" data-guide-target="session-current-item">
            <h1>{t("session.title")}</h1>
            <div className="session-page-status-row">
              <p>
                {t("session.itemProgress", { current: index + 1, total: items.length })}
              </p>
              <p data-testid="session-countdown">{t("session.timeRemaining", { time: formattedRemaining })}</p>
            </div>
            {resetCurrentResultError && <p className="error">{t("session.error", { message: resetCurrentResultError })}</p>}
            <div className="actions session-header-actions">
              <DangerousButton className="secondary-button dangerous-action-button" onConfirm={resetToSessionStart}>
                {t("session.restart")}
              </DangerousButton>
            </div>
            <section className="card">
          <SessionCurrentItem
            item={current}
            renderKey={currentRenderKey}
            reviewComplete={showPostReviewItem}
            onNewItemContinue={registerSeenItem}
            onReviewAnswered={register}
            onNextItem={continueAfterReviewedItem}
            postReviewActions={showPostReviewItem ? (
              <>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => void openItemModal(current.id)}
                  disabled={loadingOpenedItem}
                >
                  {t("words.openItem")}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => void resetCurrentResult()}
                  disabled={waitingNext || resettingCurrentResult}
                >
                  {t("session.resetCurrentResult")}
                </button>
              </>
            ) : undefined}
          />
            </section>
            {waitingNext && <p>{t("session.movingNext")}</p>}
          </main>
      {overlays}
    </>
  );
}
