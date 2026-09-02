import { API_BASE, apiFetch } from "./apiCore";

export type TimezonePreference = {
  timezone: string;
  effective_timezone: string;
};

async function timezoneError(response: Response, fallback: string): Promise<Error> {
  try {
    const payload = (await response.json()) as { detail?: string };
    return new Error(payload.detail || fallback);
  } catch {
    return new Error(fallback);
  }
}

export async function fetchTimezonePreference(): Promise<TimezonePreference> {
  const response = await apiFetch(`${API_BASE}/config/timezone`);
  if (!response.ok) {
    throw await timezoneError(response, "Failed to load timezone preference");
  }
  return (await response.json()) as TimezonePreference;
}

export async function updateTimezonePreference(timezone: string): Promise<TimezonePreference> {
  const response = await apiFetch(`${API_BASE}/config/timezone`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ timezone }),
  });
  if (!response.ok) {
    throw await timezoneError(response, "Failed to save timezone preference");
  }
  return (await response.json()) as TimezonePreference;
}
