import { useI18n } from "../../i18n";

export default function ManagePaginationCard({
  page,
  hasMore,
  busy,
  onPreviousPage,
  onNextPage,
}: {
  page: number;
  hasMore: boolean;
  busy: boolean;
  onPreviousPage: () => void;
  onNextPage: () => void;
}): JSX.Element {
  const { t } = useI18n();

  return (
    <section className="card">
      <div className="actions">
        <button type="button" className="secondary-button" onClick={onPreviousPage} disabled={page <= 1 || busy}>
          {t("manage.previousPage")}
        </button>
        <span>{t("manage.pageLabel", { page })}</span>
        <button type="button" className="secondary-button" onClick={onNextPage} disabled={!hasMore || busy}>
          {t("manage.nextPage")}
        </button>
      </div>
    </section>
  );
}
