import DangerousButton from "../DangerousButton";
import { useI18n } from "../../i18n";
import type { ContentItemRecord } from "../../types";
import type { ManageSection } from "./manageTypes";

export default function ManageItemsSection({
  currentSection,
  items,
  selectedItems,
  busy,
  deletingItemId,
  regeneratingAudioItemId,
  onToggleAllItems,
  allItemsSelected,
  onRemoveSelectedItems,
  onToggleItemSelection,
  onOpenItemModal,
  onRegenerateAudio,
}: {
  currentSection: ManageSection;
  items: ContentItemRecord[];
  selectedItems: Record<number, boolean>;
  busy: boolean;
  deletingItemId: number | null;
  regeneratingAudioItemId: number | null;
  onToggleAllItems: () => void;
  allItemsSelected: boolean;
  onRemoveSelectedItems: () => void;
  onToggleItemSelection: (itemId: number) => void;
  onOpenItemModal: (itemId: number) => void;
  onRegenerateAudio: (item: ContentItemRecord) => Promise<void>;
}): JSX.Element {
  const { t } = useI18n();

  return (
    <section className="card">
      <h2>{currentSection === "words" ? t("manage.words") : t("manage.phrases")}</h2>
      {!items.length && <p>{currentSection === "words" ? t("manage.emptyWords") : t("manage.emptyPhrases")}</p>}
      {!!items.length && (
        <ul className="manage-list">
          <li className="manage-actions-row">
            <button className="manage-toggle-all-button" onClick={onToggleAllItems} disabled={busy}>
              {allItemsSelected ? t("manage.unselectAll") : t("manage.selectAll")}
            </button>
            <DangerousButton
              className="dangerous-action-button"
              onConfirm={onRemoveSelectedItems}
              disabled={busy || !items.some((item) => selectedItems[item.id])}
            >
              {deletingItemId !== null ? t("manage.deleting") : t("manage.deleteSelectedItems")}
            </DangerousButton>
          </li>
          {items.map((item) => (
            <li key={item.id} className="manage-row manage-item-row">
              <div className="manage-item-main">
                <input
                  type="checkbox"
                  checked={Boolean(selectedItems[item.id])}
                  onChange={() => onToggleItemSelection(item.id)}
                  disabled={busy}
                />
                <div className="manage-item-text">
                  <button
                    type="button"
                    className="word-link-button manage-item-link"
                    onClick={() => onOpenItemModal(item.id)}
                  >
                    {item.german_text} - {item.spanish_text}
                  </button>
                  <span className="manage-item-meta">
                    {item.is_new
                      ? t("manage.itemStateNew")
                      : item.next_review_days === null || item.next_review_days === undefined
                        ? t("manage.nextReviewUnscheduled")
                        : t("manage.nextReviewDays", { count: item.next_review_days })}
                  </span>
                </div>
              </div>
              <DangerousButton
                className="secondary-button manage-item-action-button dangerous-action-button"
                onConfirm={() => onRegenerateAudio(item)}
                disabled={busy}
              >
                {regeneratingAudioItemId === item.id ? t("manage.regeneratingAudio") : t("manage.regenerateAudio")}
              </DangerousButton>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
