import { createContext, ReactNode, useContext, useMemo, useState } from "react";
import { useI18n } from "./i18n";

const STORAGE_KEY = "debugToolsEnabled";

export type DebugLogDetails = Record<string, unknown>;

type DebugEntry = {
  at: string;
  channel: string;
  event: string;
  details: DebugLogDetails;
};

interface DebugToolsContextValue {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  entries: DebugEntry[];
  status: string;
  clear: () => void;
  log: (channel: string, event: string, details?: DebugLogDetails) => void;
  logText: string;
  copyLog: () => Promise<void>;
}

const defaultContext: DebugToolsContextValue = {
  enabled: false,
  setEnabled: () => undefined,
  entries: [],
  status: "",
  clear: () => undefined,
  log: () => undefined,
  logText: "",
  copyLog: async () => undefined,
};

const DebugToolsContext = createContext<DebugToolsContextValue>(defaultContext);

function initialEnabled(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const params = new URLSearchParams(window.location.search);
  if (params.get("debugTools") === "1" || params.get("speechDebug") === "1") {
    return true;
  }
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function DebugToolsProvider({ children }: { children: ReactNode }): JSX.Element {
  const { t } = useI18n();
  const [enabled, setEnabledState] = useState<boolean>(initialEnabled);
  const [entries, setEntries] = useState<DebugEntry[]>([]);
  const [status, setStatus] = useState<string>("");

  const setEnabled = (nextEnabled: boolean): void => {
    setEnabledState(nextEnabled);
    setStatus(t(nextEnabled ? "config.debugEnabled" : "config.debugDisabled"));
    try {
      window.localStorage.setItem(STORAGE_KEY, nextEnabled ? "1" : "0");
    } catch {
      // Ignore storage failures; the in-memory toggle still works.
    }
  };

  const log = (channel: string, event: string, details: DebugLogDetails = {}): void => {
    if (!enabled) {
      return;
    }
    const entry = {
      at: new Date().toISOString().slice(11, 23),
      channel,
      event,
      details,
    };
    console.debug(`[${channel}]`, entry);
    setStatus(`${entry.at} ${channel}.${event}`);
    setEntries((current) => [...current.slice(-119), entry]);
  };

  const clear = (): void => {
    setEntries([]);
    setStatus(t("config.debugCleared"));
  };

  const logText = entries
    .slice()
    .reverse()
    .map((entry) => `${entry.at} ${entry.channel}.${entry.event} ${JSON.stringify(entry.details)}`)
    .join("\n");

  const copyLog = async (): Promise<void> => {
    const text = logText || t("config.debugEmptyLog");
    try {
      await navigator.clipboard.writeText(text);
      setStatus(t("config.debugCopied", { count: entries.length }));
    } catch {
      setStatus(t("config.debugCopyFailed"));
    }
  };

  const value = useMemo<DebugToolsContextValue>(
    () => ({
      enabled,
      setEnabled,
      entries,
      status,
      clear,
      log,
      logText,
      copyLog,
    }),
    [enabled, entries, status, logText, t],
  );

  return <DebugToolsContext.Provider value={value}>{children}</DebugToolsContext.Provider>;
}

export function useDebugTools(): DebugToolsContextValue {
  return useContext(DebugToolsContext);
}

function snapshotSpeechSynthesis(): DebugLogDetails {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return { available: false };
  }
  return {
    available: true,
    speaking: window.speechSynthesis.speaking,
    pending: window.speechSynthesis.pending,
    paused: window.speechSynthesis.paused,
    voices: window.speechSynthesis.getVoices().length,
  };
}

const retainedDebugUtterances = new Set<SpeechSynthesisUtterance>();

function testSpeechSynthesis(log: (channel: string, event: string, details?: DebugLogDetails) => void): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
    log("manual", "test_speech.unavailable", { available: false });
    return;
  }

  const speechSynthesis = window.speechSynthesis;
  const voices = speechSynthesis.getVoices();
  const germanVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith("de"));
  const selectedVoice = germanVoices[0] || voices[0];
  const utterance = new SpeechSynthesisUtterance("Debug speech test");
  utterance.lang = selectedVoice?.lang || "de-DE";
  utterance.rate = 0.8;
  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }

  retainedDebugUtterances.add(utterance);
  log("manual", "test_speech.start", {
    selectedVoice: selectedVoice?.voiceURI || "",
    selectedLang: selectedVoice?.lang || "",
    retainedUtterances: retainedDebugUtterances.size,
    ...snapshotSpeechSynthesis(),
  });

  const finish = (reason: string, extra: DebugLogDetails = {}): void => {
    retainedDebugUtterances.delete(utterance);
    log("manual", "test_speech.finish", {
      reason,
      retainedUtterances: retainedDebugUtterances.size,
      ...extra,
      ...snapshotSpeechSynthesis(),
    });
  };

  utterance.onstart = () => log("manual", "test_speech.onstart", snapshotSpeechSynthesis());
  utterance.onend = () => finish("onend");
  utterance.onerror = (event) => finish("onerror", { error: (event as SpeechSynthesisErrorEvent).error });

  speechSynthesis.resume();
  try {
    speechSynthesis.speak(utterance);
    log("manual", "test_speech.speak_called", snapshotSpeechSynthesis());
  } catch (error) {
    finish("throw", { error: error instanceof Error ? error.message : String(error) });
  }
}

export function DebugToolsPanel(): JSX.Element | null {
  const { t } = useI18n();
  const { enabled, entries, status, clear, log, logText, copyLog } = useDebugTools();

  if (!enabled) {
    return null;
  }

  return (
    <details className="debug-tools-panel" open>
      <summary>{t("config.debugTools")} ({entries.length})</summary>
      {status ? <p className="hint">{t("config.debugLastAction", { status })}</p> : null}
      <div className="actions debug-tools-actions">
        <button type="button" className="secondary-button" onClick={clear}>
          {t("config.debugClear")}
        </button>
        <button type="button" className="secondary-button" onClick={() => log("manual", "snapshot", snapshotSpeechSynthesis())}>
          {t("config.debugSnapshot")}
        </button>
        <button type="button" className="secondary-button" onClick={() => testSpeechSynthesis(log)}>
          {t("config.debugTestSpeech")}
        </button>
        <button type="button" className="secondary-button" onClick={() => void copyLog()}>
          {t("config.debugCopy")}
        </button>
      </div>
      <pre className="debug-tools-log">{logText || t("config.debugEmptyHint")}</pre>
    </details>
  );
}
