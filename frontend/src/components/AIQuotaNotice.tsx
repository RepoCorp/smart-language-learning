import { useEffect, useState } from "react";

import { getAIQuotaReachedEventName } from "../apiCore";

export default function AIQuotaNotice(): JSX.Element | null {
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
      <span>{message}</span>
      <button type="button" onClick={() => setMessage("")} aria-label="Dismiss quota notice">x</button>
    </div>
  );
}
