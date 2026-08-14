import type { ReactNode } from "react";

import { useI18n } from "../i18n";

function LoadingOverlay({
  fullScreen,
  message,
}: {
  fullScreen: boolean;
  message: string;
}): JSX.Element {
  const { t } = useI18n();
  return (
    <div className={fullScreen ? "fullscreen-loading-overlay" : "blocking-loading-overlay"} role="status" aria-live="polite">
      <span className="blocking-loading-spinner" aria-hidden="true" />
      <p className="blocking-loading-message">{message}</p>
      <p className="blocking-loading-reassurance">{t("loading.reassurance")}</p>
    </div>
  );
}

export function FullScreenLoadingOverlay({
  loading,
  message,
}: {
  loading: boolean;
  message: string;
}): JSX.Element | null {
  return loading ? <LoadingOverlay fullScreen message={message} /> : null;
}

export default function BlockingLoadingOverlay({
  loading,
  message,
  fullScreen = false,
  children,
}: {
  loading: boolean;
  message: string;
  fullScreen?: boolean;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className="blocking-loading-region" aria-busy={loading}>
      {children}
      {loading && <LoadingOverlay fullScreen={fullScreen} message={message} />}
    </div>
  );
}
