import { useI18n } from "../../i18n";
import type { ManageReviewState, ManageSection } from "./manageTypes";

export default function ManageFilterCard({
  currentSection,
  filterQuery,
  reviewState,
  busy,
  onFilterChange,
  onClearFilter,
  onReviewStateChange,
}: {
  currentSection: ManageSection;
  filterQuery: string;
  reviewState: ManageReviewState;
  busy: boolean;
  onFilterChange: (value: string) => void;
  onClearFilter: () => void;
  onReviewStateChange: (value: ManageReviewState) => void;
}): JSX.Element {
  const { t } = useI18n();

  return (
    <section className="card">
      <label htmlFor="manage-filter" className="prompt">{t("manage.filterLabel")}</label>
      <div className="actions">
        <input
          id="manage-filter"
          value={filterQuery}
          onChange={(event) => onFilterChange(event.target.value)}
          placeholder={t("manage.filterPlaceholder")}
          disabled={busy}
        />
        <button
          type="button"
          className="secondary-button"
          onClick={onClearFilter}
          disabled={!filterQuery || busy}
        >
          {t("manage.filterClear")}
        </button>
      </div>
      {currentSection !== "topics" && (
        <div className="actions">
          <button
            type="button"
            className={reviewState === "all" ? "secondary-button" : ""}
            onClick={() => onReviewStateChange("all")}
            disabled={busy}
          >
            {t("manage.reviewStateAll")}
          </button>
          <button
            type="button"
            className={reviewState === "new" ? "secondary-button" : ""}
            onClick={() => onReviewStateChange("new")}
            disabled={busy}
          >
            {t("manage.reviewStateNew")}
          </button>
        </div>
      )}
    </section>
  );
}
