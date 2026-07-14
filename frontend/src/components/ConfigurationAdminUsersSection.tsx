import { FormEvent, useEffect, useState } from "react";

import {
  createUserWithPin,
  fetchRegisteredUsers,
  resetUserPin,
  type AuthUser,
} from "../authApi";
import { useI18n } from "../i18n";

interface ConfigurationAdminUsersSectionProps {
  canCreateUsers?: boolean;
}

export default function ConfigurationAdminUsersSection({
  canCreateUsers = false,
}: ConfigurationAdminUsersSectionProps): JSX.Element | null {
  const { t } = useI18n();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [resetIdentifier, setResetIdentifier] = useState("");
  const [resetPin, setResetPin] = useState("");
  const [resettingPin, setResettingPin] = useState(false);
  const [resetPinError, setResetPinError] = useState("");
  const [resetPinSuccess, setResetPinSuccess] = useState("");
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState("");

  const loadUsers = async (): Promise<void> => {
    setLoadingUsers(true);
    setUsersError("");
    try {
      const registeredUsers = await fetchRegisteredUsers();
      setUsers(registeredUsers);
    } catch (error) {
      setUsersError(error instanceof Error ? error.message : t("config.registeredUsersLoadFailed"));
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (!canCreateUsers) {
      return;
    }
    void loadUsers();
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
      const user = await createUserWithPin(username, email, pin);
      setCreateSuccess(t("config.userCreated", { username: user.username }));
      setUsername("");
      setEmail("");
      setPin("");
      void loadUsers();
    } catch (error) {
      const message = error instanceof Error ? error.message : t("config.createUserFailed");
      setCreateError(message);
    } finally {
      setCreating(false);
    }
  };

  const handleResetPin = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setResetPinError("");
    setResetPinSuccess("");
    setResettingPin(true);
    try {
      const user = await resetUserPin(resetIdentifier, resetPin);
      setResetPinSuccess(t("config.resetPinSuccess", { username: user.username }));
      setResetIdentifier("");
      setResetPin("");
    } catch (error) {
      const message = error instanceof Error ? error.message : t("config.resetPinFailed");
      setResetPinError(message);
    } finally {
      setResettingPin(false);
    }
  };

  return (
    <>
      <section className="card settings-card">
        <h2 className="settings-title">{t("config.registeredUsersTitle")}</h2>
        <p className="settings-subtitle">{t("config.registeredUsersSubtitle")}</p>
        {loadingUsers ? <p className="hint">{t("config.registeredUsersLoading")}</p> : null}
        {usersError ? <p className="error">{usersError}</p> : null}
        {!loadingUsers && !usersError ? (
          <div className="elevenlabs-voice-list">
            {users.map((user) => (
              <div key={user.id} className="elevenlabs-voice-row">
                <div className="elevenlabs-voice-main">
                  <strong>{user.username}</strong>
                  <span className="hint">{user.email}</span>
                </div>
                <div className="elevenlabs-voice-actions">
                  {user.is_superuser ? <span className="hint">{t("config.registeredUsersAdmin")}</span> : null}
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
          <label className="settings-field">
            {t("config.pin")}
            <input
              type="password"
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              autoComplete="new-password"
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
        </form>
      </section>
      <section className="card settings-card">
        <h2 className="settings-title">{t("config.resetPinTitle")}</h2>
        <p className="settings-subtitle">{t("config.resetPinSubtitle")}</p>
        <form className="settings-create-user-form" onSubmit={handleResetPin}>
          <label className="settings-field">
            {t("config.userIdentifier")}
            <input
              type="text"
              value={resetIdentifier}
              onChange={(event) => setResetIdentifier(event.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label className="settings-field">
            {t("config.newPin")}
            <input
              type="password"
              value={resetPin}
              onChange={(event) => setResetPin(event.target.value)}
              autoComplete="new-password"
              required
            />
          </label>
          <div className="actions">
            <button type="submit" disabled={resettingPin}>
              {resettingPin ? t("config.resettingPin") : t("config.resetPin")}
            </button>
          </div>
          {resetPinError ? <p className="error">{resetPinError}</p> : null}
          {resetPinSuccess ? <p className="hint">{resetPinSuccess}</p> : null}
        </form>
      </section>
    </>
  );
}
