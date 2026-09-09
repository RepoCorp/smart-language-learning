import { useEffect, useState } from "react";

import {
  fetchAdminAIUsage,
  type AdminAIUsageUser,
  updateAdminAIUsageLimit,
} from "../../../adminUsageApi";
import { deleteUserAccount } from "../../../authApi";
import { useI18n } from "../../../i18n";

interface ConfigurationAdminAIUsageSectionProps {
  canManage: boolean;
  refreshKey?: number;
}

type LimitField =
  | "weekly_generation_credits"
  | "weekly_elevenlabs_characters"
  | "weekly_elevenlabs_music_seconds"
  | "weekly_realtime_minutes";

export default function ConfigurationAdminAIUsageSection({
  canManage,
  refreshKey = 0,
}: ConfigurationAdminAIUsageSectionProps): JSX.Element | null {
  const { t } = useI18n();
  const [users, setUsers] = useState<AdminAIUsageUser[]>([]);
  const [defaults, setDefaults] = useState({ weekly_generation_credits: 0, weekly_elevenlabs_characters: 0, weekly_elevenlabs_music_seconds: 0, weekly_realtime_minutes: 0 });
  const [quotaInputValues, setQuotaInputValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [savingUserId, setSavingUserId] = useState<number | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);

  const load = async (): Promise<void> => {
    setLoading(true);
    setError("");
    try {
      const response = await fetchAdminAIUsage();
      setUsers(response.users);
      setDefaults(response.defaults);
      setQuotaInputValues({});
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load AI usage");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canManage) {
      void load();
    }
  }, [canManage, refreshKey]);

  if (!canManage) {
    return null;
  }

  const updateUser = (userId: number, changes: Partial<AdminAIUsageUser>): void => {
    setUsers((current) => current.map((user) => user.id === userId ? { ...user, ...changes } : user));
  };

  const updateQuotaInput = (userId: number, field: LimitField, value: string): void => {
    const inputKey = `${userId}:${field}`;
    setQuotaInputValues((current) => ({ ...current, [inputKey]: value }));
    updateUser(userId, { [field]: Number(value || 0) });
  };

  const restoreDefaultQuotaInput = (userId: number, field: LimitField): void => {
    const inputKey = `${userId}:${field}`;
    if (quotaInputValues[inputKey] === "") {
      setQuotaInputValues((current) => ({ ...current, [inputKey]: "0" }));
    }
  };

  const save = async (user: AdminAIUsageUser): Promise<void> => {
    setSavingUserId(user.id);
    setError("");
    try {
      await updateAdminAIUsageLimit(user);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update AI usage limit");
    } finally {
      setSavingUserId(null);
    }
  };

  const deleteUser = async (user: AdminAIUsageUser): Promise<void> => {
    if (!window.confirm(t("config.deleteUserConfirm", { username: user.username }))) {
      return;
    }
    setDeletingUserId(user.id);
    setError("");
    try {
      await deleteUserAccount(user.id);
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : t("config.deleteUserFailed"));
    } finally {
      setDeletingUserId(null);
    }
  };

  const usageSummary = (user: AdminAIUsageUser): string => (
    `This week: ${user.week_generation_credits} OpenAI credits, ${user.week_elevenlabs_characters} ElevenLabs characters, ${user.week_elevenlabs_music_seconds} Eleven Music seconds, ${user.week_realtime_minutes} live minutes`
  );

  const renderLimitInput = (user: AdminAIUsageUser, field: LimitField, label: string): JSX.Element => (
    <label>
      {label}
      <input
        type="number"
        min="0"
        value={quotaInputValues[`${user.id}:${field}`] ?? String(user[field])}
        onChange={(event) => updateQuotaInput(user.id, field, event.target.value)}
        onBlur={() => restoreDefaultQuotaInput(user.id, field)}
      />
    </label>
  );

  return (
    <section className="card settings-card">
      <h2 className="settings-title">{t("config.registeredUsersTitle")}</h2>
      <p className="settings-subtitle">{t("config.registeredUsersSubtitle")}</p>
      <p className="hint">
        Default weekly budget: {defaults.weekly_generation_credits} OpenAI credits, {defaults.weekly_elevenlabs_characters} ElevenLabs characters, {defaults.weekly_elevenlabs_music_seconds} Eleven Music seconds, and {defaults.weekly_realtime_minutes} live minutes. A limit of 0 uses these defaults.
      </p>
      {loading ? <p className="hint">{t("config.registeredUsersLoading")}</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {!loading && !error ? (
        <div className="ai-usage-list">
          {users.map((user) => (
            <details className="admin-user-usage-card" key={user.id}>
              <summary>
                <span className="admin-user-usage-account">
                  <strong>{user.username}</strong>
                  <span className="hint">{user.email}</span>
                  {user.is_superuser ? <span className="hint">{t("config.registeredUsersAdmin")}</span> : null}
                </span>
                <span className="hint admin-user-usage-summary">{usageSummary(user)}</span>
                <span className="admin-user-usage-caret" aria-hidden="true">▾</span>
              </summary>
              <div className="admin-user-usage-details">
                <div className="ai-usage-limits-grid">
                  <label><input type="checkbox" checked={user.is_blocked} onChange={(event) => updateUser(user.id, { is_blocked: event.target.checked })} /> Block AI</label>
                  {renderLimitInput(user, "weekly_generation_credits", "Generation credits")}
                  {renderLimitInput(user, "weekly_elevenlabs_characters", "ElevenLabs characters")}
                  {renderLimitInput(user, "weekly_elevenlabs_music_seconds", "Eleven Music seconds")}
                  {renderLimitInput(user, "weekly_realtime_minutes", "Live minutes")}
                </div>
                <div className="actions">
                  <button type="button" className="secondary-button" disabled={savingUserId === user.id} onClick={() => void save(user)}>Save limits</button>
                  {!user.is_superuser ? (
                    <button type="button" className="dangerous-button" disabled={deletingUserId === user.id} onClick={() => void deleteUser(user)}>
                      {deletingUserId === user.id ? t("config.deletingUser") : t("config.deleteUser")}
                    </button>
                  ) : null}
                </div>
              </div>
            </details>
          ))}
        </div>
      ) : null}
    </section>
  );
}
