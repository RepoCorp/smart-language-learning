import { useEffect, useState } from "react";

import { getAIQuotaReachedEventName } from "../apiCore";
import { useI18n, type MessageKey } from "../i18n";

// The API currently supplies quota reasons as English text, not error codes.
const quotaMessageKeys: Record<string, MessageKey> = {
  "Your AI allowance has been reached. Please try again next week.": "quota.reached",
  "AI generation is disabled for this account.": "quota.blocked",
  "Your weekly live conversation minute limit has been reached. Please try again next week.": "quota.live",
  "Your weekly Eleven Music limit has been reached. Please try again next week.": "quota.music",
  "Your weekly ElevenLabs character limit has been reached. Please try again next week.": "quota.characters",
  "Your weekly AI usage limit has been reached. Please try again next week.": "quota.generation",
};

export default function AIQuotaNotice(): JSX.Element | null {
  const { t } = useI18n();
  const [message, setMessage] = useState("");

  useEffect(() => {
    const handleQuotaReached = (event: Event): void => {
      const detail = event instanceof CustomEvent ? event.detail : "";
      setMessage(typeof detail === "string" && detail ? detail : "Your AI allowance has been reached. Please try again next week.");
    };
    window.addEventListener(getAIQuotaReachedEventName(), handleQuotaReached);
    return () => window.removeEventListener(getAIQuotaReachedEventName(), handleQuotaReached);
  }, []);

  if (!message) {
    return null;
  }

  return (
    <div className="ai-quota-notice" role="alert">
      <span>{quotaMessageKeys[message] ? t(quotaMessageKeys[message]) : message}</span>
      <button type="button" onClick={() => setMessage("")} aria-label={t("quota.dismiss")}>x</button>
    </div>
  );
}
