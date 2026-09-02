import { useEffect, useState } from "react";

import { useI18n } from "../i18n";
import { fetchTimezonePreference, updateTimezonePreference } from "../timezoneApi";

function browserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export default function ConfigurationTimezoneSection(): JSX.Element {
  const { t } = useI18n();
  const [timezone, setTimezone] = useState(browserTimezone);
  const [suggestedTimezone] = useState(browserTimezone);
  const [savedTimezone, setSavedTimezone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void fetchTimezonePreference()
      .then((preference) => {
        if (!active) {
          return;
        }
        const configuredTimezone = preference.timezone || suggestedTimezone;
        setTimezone(configuredTimezone);
        setSavedTimezone(preference.timezone);
      })
      .catch(() => {
        if (active) {
          setError(t("config.timezoneLoadError"));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [suggestedTimezone, t]);

  async function saveTimezone(): Promise<void> {
    setSaving(true);
    setError("");
    try {
      const preference = await updateTimezonePreference(timezone);
      setTimezone(preference.timezone);
      setSavedTimezone(preference.timezone);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t("config.timezoneSaveError"));
    } finally {
      setSaving(false);
    }
  }

  const changed = timezone !== savedTimezone;

  return (
    <section className="card settings-card">
      <h2 className="settings-title">{t("config.timezoneTitle")}</h2>
      <p className="settings-subtitle">{t("config.timezoneSubtitle")}</p>
      <div className="settings-grid">
        <label className="settings-field">
          {t("config.timezoneLabel")}
          <input
            type="text"
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            placeholder={suggestedTimezone}
            disabled={loading || saving}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </label>
      </div>
      <p className="settings-subtitle">{t("config.timezoneSuggestion", { timezone: suggestedTimezone })}</p>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="actions configuration-account-actions">
        <button type="button" className="secondary-button" onClick={() => void saveTimezone()} disabled={loading || saving || !changed}>
          {saving ? t("config.timezoneSaving") : t("config.timezoneSave")}
        </button>
      </div>
    </section>
  );
}
