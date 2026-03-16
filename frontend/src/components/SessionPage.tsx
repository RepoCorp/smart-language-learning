import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { fetchSession, markSeen, submitReview } from "../api";
import { useI18n } from "../i18n";
import { useStudyLanguages } from "../studyLanguages";
import type { SessionItem } from "../types";
import NewItem from "./NewItem";
import PhraseReview from "./PhraseReview";
import WordReview from "./WordReview";

export default function SessionPage(): JSX.Element {
  const { t } = useI18n();
  const { sourceLanguage, targetLanguage } = useStudyLanguages();
  const [items, setItems] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [index, setIndex] = useState<number>(0);
  const [waitingNext, setWaitingNext] = useState<boolean>(false);
  const [showIncorrectReviewItem, setShowIncorrectReviewItem] = useState<boolean>(false);

  const loadSession = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError("");
    setShowIncorrectReviewItem(false);
    try {
      const data = await fetchSession(5, sourceLanguage, targetLanguage);
      setItems(data.items || []);
      setIndex(0);
    } catch {
      setError(t("session.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t, sourceLanguage, targetLanguage]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const current = items[index];

  const advance = (): void => {
    setWaitingNext(true);
    setTimeout(() => {
      setIndex((value) => {
        const nextIndex = value + 1;
        if (nextIndex >= items.length) {
          void loadSession();
          return 0;
        }
        return nextIndex;
      });
      setWaitingNext(false);
    }, 450);
  };

  const register = async (correct: boolean): Promise<void> => {
    if (!current) {
      return;
    }
    await submitReview(current.id, correct, current.direction ?? undefined);
    if (correct) {
      advance();
      return;
    }
    setShowIncorrectReviewItem(true);
  };

  const registerSeenItem = async (): Promise<void> => {
    if (!current) {
      return;
    }
    await markSeen(current.id);
    advance();
  };

  const continueAfterIncorrectReview = async (): Promise<void> => {
    setWaitingNext(true);
    setTimeout(() => {
      setIndex((value) => {
        const nextIndex = value + 1;
        if (nextIndex >= items.length) {
          void loadSession();
          return 0;
        }
        return nextIndex;
      });
      setShowIncorrectReviewItem(false);
      setWaitingNext(false);
    }, 450);
  };

  if (loading) {
    return <main className="container">{t("session.loading")}</main>;
  }

  if (error) {
    return <main className="container error">{t("session.error", { message: error })}</main>;
  }

  if (!items.length) {
    return (
      <main className="container">
        <p>{t("session.empty")}</p>
        <p>
          <Link to="/content/create">{t("session.createContent")}</Link> |{" "}
          <Link to="/content/manage">{t("content.manageLink")}</Link>
        </p>
      </main>
    );
  }

  if (!current) {
    return <main className="container">{t("session.loading")}</main>;
  }

  return (
    <main className="container" data-testid="session-page">
      <h1>{t("session.title")}</h1>
      <p>
        <Link to="/content/create">{t("session.createContent")}</Link> |{" "}
        <Link to="/content/manage">{t("content.manageLink")}</Link>
      </p>
      <p>
        {t("session.itemProgress", { current: index + 1, total: items.length })}
      </p>
      <section className="card">
        {showIncorrectReviewItem ? (
          <NewItem key={`incorrect-${current.id}`} item={current} onContinue={continueAfterIncorrectReview} />
        ) : current.mode === "new" ? (
          <NewItem
            key={current.id}
            item={current}
            onContinue={registerSeenItem}
          />
        ) : current.item_type === "word" ? (
          <WordReview key={current.id} item={current} onAnswered={register} />
        ) : (
          <PhraseReview key={current.id} item={current} onAnswered={register} />
        )}
      </section>
      {waitingNext && <p>{t("session.movingNext")}</p>}
    </main>
  );
}
