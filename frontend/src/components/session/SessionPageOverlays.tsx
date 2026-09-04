import { useI18n } from "../../i18n";
import type { SessionItem } from "../../types";
import NewItem from "../NewItem";

interface SessionPageOverlaysProps {
  openedItem: SessionItem | null;
  loadingOpenedItem: boolean;
  openedItemError: string;
  onCloseItem: () => void;
  showNewItemCelebration: boolean;
  onDismissCelebration: () => void;
}

export default function SessionPageOverlays({
  openedItem,
  loadingOpenedItem,
  openedItemError,
  onCloseItem,
  showNewItemCelebration,
  onDismissCelebration,
}: SessionPageOverlaysProps): JSX.Element {
  const { t } = useI18n();

  return (
    <>
      {(loadingOpenedItem || openedItem || openedItemError) ? (
        <div className="blocking-modal-overlay" role="dialog" aria-modal="true">
          <div className="blocking-modal related-dialogs-modal">
            {!openedItem && <button type="button" className="modal-corner-close" aria-label={t("words.close")} onClick={onCloseItem}>×</button>}
            {loadingOpenedItem && <p>{t("session.loading")}</p>}
            {!loadingOpenedItem && openedItemError && <p className="error">{openedItemError}</p>}
            {!loadingOpenedItem && openedItem && <NewItem item={openedItem} readOnly onClose={onCloseItem} />}
          </div>
        </div>
      ) : null}
      {showNewItemCelebration ? (
        <div className="blocking-modal-overlay session-celebration-overlay" role="dialog" aria-modal="true">
          <section className="blocking-modal session-celebration-modal">
            <div className="session-celebration-burst" aria-hidden="true">
              {Array.from({ length: 18 }, (_, index) => <span key={index} />)}
            </div>
            <p className="session-celebration-kicker">{t("session.newWordsCelebrationKicker")}</p>
            <h2>{t("session.newWordsCelebrationTitle")}</h2>
            <p>{t("session.newWordsCelebrationMessage")}</p>
            <div className="actions">
              <button type="button" onClick={onDismissCelebration}>{t("session.newWordsCelebrationContinue")}</button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
