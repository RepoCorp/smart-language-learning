import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { fetchSession, markSeen, submitReview } from "../api";
import type { SessionItem } from "../types";
import NewItem from "./NewItem";
import PhraseReview from "./PhraseReview";
import WordReview from "./WordReview";

export default function SessionPage(): JSX.Element {
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
      const data = await fetchSession(5);
      setItems(data.items || []);
      setIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load session");
    } finally {
      setLoading(false);
    }
  }, []);

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
    return <main className="container">Loading session...</main>;
  }

  if (error) {
    return <main className="container error">Error: {error}</main>;
  }

  if (!items.length) {
    return <main className="container">No content available.</main>;
  }

  if (!current) {
    return <main className="container">Loading session...</main>;
  }

  return (
    <main className="container" data-testid="session-page">
      <h1>Learning session</h1>
      <p>
        <Link to="/content/create">Create content</Link>
      </p>
      <p>
        Item {index + 1} of {items.length}
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
      {waitingNext && <p>Moving to the next item...</p>}
    </main>
  );
}
