import type { ReactNode } from "react";

import { useI18n } from "../i18n";

export default function BlockingLoadingOverlay({
  loading,
  message,
  children,
}: {
  loading: boolean;
  message: string;
  children: ReactNode;
}): JSX.Element {
  const { t } = useI18n();
  return (
    <div className="blocking-loading-region" aria-busy={loading}>
      {children}
      {loading && (
        <div className="blocking-loading-overlay" role="status" aria-live="polite">
          <span className="blocking-loading-spinner" aria-hidden="true" />
          <p className="blocking-loading-message">{message}</p>
          <p className="blocking-loading-reassurance">{t("loading.reassurance")}</p>
        </div>
      )}
    </div>
  );
}
