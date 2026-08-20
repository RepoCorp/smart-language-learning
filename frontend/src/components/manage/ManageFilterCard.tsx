import { useI18n } from "../../i18n";

export default function ManageFilterCard({
  filterQuery,
  busy,
  onFilterChange,
  onClearFilter,
}: {
  filterQuery: string;
  busy: boolean;
  onFilterChange: (value: string) => void;
  onClearFilter: () => void;
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
    </section>
  );
}
