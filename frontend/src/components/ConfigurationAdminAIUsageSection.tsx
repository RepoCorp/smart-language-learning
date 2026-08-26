import { useEffect, useState } from "react";

import {
  fetchAdminAIUsage,
  type AdminAIUsageUser,
  updateAdminAIUsageLimit,
} from "../authApi";

interface ConfigurationAdminAIUsageSectionProps {
  canManage: boolean;
}

export default function ConfigurationAdminAIUsageSection({
  canManage,
}: ConfigurationAdminAIUsageSectionProps): JSX.Element | null {
  const [users, setUsers] = useState<AdminAIUsageUser[]>([]);
  const [defaults, setDefaults] = useState({ weekly_generation_credits: 0, weekly_elevenlabs_characters: 0, weekly_realtime_minutes: 0 });
  const [quotaInputValues, setQuotaInputValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [savingUserId, setSavingUserId] = useState<number | null>(null);

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
  }, [canManage]);

  if (!canManage) {
    return null;
  }

  const updateUser = (userId: number, changes: Partial<AdminAIUsageUser>): void => {
    setUsers((current) => current.map((user) => user.id === userId ? { ...user, ...changes } : user));
  };

  const updateQuotaInput = (
    userId: number,
    field: "weekly_generation_credits" | "weekly_elevenlabs_characters" | "weekly_realtime_minutes",
    value: string,
  ): void => {
    const inputKey = `${userId}:${field}`;
    setQuotaInputValues((current) => ({ ...current, [inputKey]: value }));
    updateUser(userId, { [field]: Number(value || 0) });
  };

  const restoreDefaultQuotaInput = (
    userId: number,
    field: "weekly_generation_credits" | "weekly_elevenlabs_characters" | "weekly_realtime_minutes",
  ): void => {
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

  return (
    <section className="card settings-card">
      <h2 className="settings-title">AI usage limits</h2>
      <p className="settings-subtitle">
        Default weekly budget: {defaults.weekly_generation_credits} OpenAI generation credits, {defaults.weekly_elevenlabs_characters} ElevenLabs characters, and {defaults.weekly_realtime_minutes} live minutes.
        A user limit of 0 uses these defaults.
      </p>
      {loading ? <p className="hint">Loading AI usage...</p> : null}
      {error ? <p className="error">{error}</p> : null}
      <div className="ai-usage-list">
        {users.map((user) => (
          <div className="ai-usage-row" key={user.id}>
            <div>
              <strong>{user.username}</strong>
              <p className="hint">This week: {user.week_generation_credits} OpenAI generation credits, {user.week_elevenlabs_characters} ElevenLabs characters, {user.week_realtime_minutes} live minutes</p>
            </div>
            <label><input type="checkbox" checked={user.is_blocked} onChange={(event) => updateUser(user.id, { is_blocked: event.target.checked })} /> Block AI</label>
            <label>
              Generation credits
              <input
                type="number"
                min="0"
                value={quotaInputValues[`${user.id}:weekly_generation_credits`] ?? String(user.weekly_generation_credits)}
                onChange={(event) => updateQuotaInput(user.id, "weekly_generation_credits", event.target.value)}
                onBlur={() => restoreDefaultQuotaInput(user.id, "weekly_generation_credits")}
              />
            </label>
            <label>
              ElevenLabs characters
              <input
                type="number"
                min="0"
                value={quotaInputValues[`${user.id}:weekly_elevenlabs_characters`] ?? String(user.weekly_elevenlabs_characters)}
                onChange={(event) => updateQuotaInput(user.id, "weekly_elevenlabs_characters", event.target.value)}
                onBlur={() => restoreDefaultQuotaInput(user.id, "weekly_elevenlabs_characters")}
              />
            </label>
            <label>
              Live minutes
              <input
                type="number"
                min="0"
                value={quotaInputValues[`${user.id}:weekly_realtime_minutes`] ?? String(user.weekly_realtime_minutes)}
                onChange={(event) => updateQuotaInput(user.id, "weekly_realtime_minutes", event.target.value)}
                onBlur={() => restoreDefaultQuotaInput(user.id, "weekly_realtime_minutes")}
              />
            </label>
            <button type="button" className="secondary-button" disabled={savingUserId === user.id} onClick={() => void save(user)}>Save</button>
          </div>
        ))}
      </div>
    </section>
  );
}
