import { FormEvent, useEffect, useState } from "react";

import {
  createUserWithPinSetup,
  fetchRegistrationRequests,
  type RegistrationRequestRecord,
} from "../authApi";
import { useI18n } from "../i18n";
import ConfigurationAdminAIUsageSection from "./ConfigurationAdminAIUsageSection";

interface ConfigurationAdminUsersSectionProps {
  canCreateUsers?: boolean;
}

export default function ConfigurationAdminUsersSection({
  canCreateUsers = false,
}: ConfigurationAdminUsersSectionProps): JSX.Element | null {
  const { t } = useI18n();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [pinSetupLink, setPinSetupLink] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [registrationRequests, setRegistrationRequests] = useState<RegistrationRequestRecord[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [requestsError, setRequestsError] = useState("");
  const [usersRefreshKey, setUsersRefreshKey] = useState(0);

  const loadAdminData = async (): Promise<void> => {
    setLoadingRequests(true);
    setRequestsError("");
    try {
      setRegistrationRequests(await fetchRegistrationRequests());
    } catch (error) {
      const message = error instanceof Error ? error.message : t("config.registeredUsersLoadFailed");
      setRequestsError(message);
    } finally {
      setLoadingUsers(false);
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    if (!canCreateUsers) {
      return;
    }
    void loadAdminData();
  }, [canCreateUsers]);

  if (!canCreateUsers) {
    return null;
  }

  const handleCreateUser = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setCreateError("");
    setCreateSuccess("");
    setCreating(true);
    try {
      const created = await createUserWithPinSetup(username, email);
      setCreateSuccess(t("config.userCreated", { username: created.user.username }));
      setPinSetupLink(`${window.location.origin}/set-pin?token=${encodeURIComponent(created.pin_setup_token)}`);
      setUsername("");
      setEmail("");
      setUsersRefreshKey((current) => current + 1);
      void loadAdminData();
    } catch (error) {
      const message = error instanceof Error ? error.message : t("config.createUserFailed");
      setCreateError(message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <ConfigurationAdminAIUsageSection canManage={canCreateUsers} refreshKey={usersRefreshKey} />
      <section className="card settings-card">
        <h2 className="settings-title">{t("config.registrationRequestsTitle")}</h2>
        <p className="settings-subtitle">{t("config.registrationRequestsSubtitle")}</p>
        {loadingRequests ? <p className="hint">{t("config.registrationRequestsLoading")}</p> : null}
        {requestsError ? <p className="error">{requestsError}</p> : null}
        {!loadingRequests && !requestsError && registrationRequests.length === 0 ? (
          <p className="hint">{t("config.registrationRequestsEmpty")}</p>
        ) : null}
        {!loadingRequests && !requestsError && registrationRequests.length > 0 ? (
          <div className="elevenlabs-voice-list">
            {registrationRequests.map((request) => (
              <div key={request.id} className="elevenlabs-voice-row">
                <div className="elevenlabs-voice-main">
                  <strong>{request.username}</strong>
                  <span className="hint">{request.email}</span>
                  <span className="hint">{new Date(request.created_at).toLocaleString()}</span>
                </div>
                <div className="elevenlabs-voice-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setUsername(request.username);
                      setEmail(request.email);
                    }}
                  >
                    {t("config.registrationRequestsUse")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>
      <section className="card settings-card">
        <h2 className="settings-title">{t("config.createUserTitle")}</h2>
        <p className="settings-subtitle">{t("config.createUserSubtitle")}</p>
        <form className="settings-create-user-form" onSubmit={handleCreateUser}>
          <label className="settings-field">
            {t("config.username")}
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label className="settings-field">
            {t("config.email")}
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <div className="actions">
            <button type="submit" disabled={creating}>
              {creating ? t("config.creatingUser") : t("config.createUser")}
            </button>
          </div>
          {createError ? <p className="error">{createError}</p> : null}
          {createSuccess ? <p className="hint">{createSuccess}</p> : null}
          {pinSetupLink ? (
            <div className="pin-setup-link">
              <span>{t("config.pinSetupLink")}</span>
              <input type="text" value={pinSetupLink} readOnly aria-label={t("config.pinSetupLink")} />
            </div>
          ) : null}
        </form>
      </section>
    </>
  );
}
