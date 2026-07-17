import { API_BASE, apiFetch, notifyOverviewStatsUpdated } from "./apiCore";

const AUTH_TOKEN_KEY = "smart-language-learning-auth-token";
const AUTH_USER_KEY = "smart-language-learning-auth-user";

export type AuthUser = {
  id: number;
  username: string;
  email: string;
  is_superuser: boolean;
};

export type RegistrationRequestRecord = {
  id: number;
  username: string;
  email: string;
  created_at: string;
};

type RegistrationRequestResponse = {
  ok: boolean;
  message: string;
};

type AuthBootstrapStatusResponse = {
  can_public_register?: boolean;
};

type RegisteredUsersResponse = {
  users: AuthUser[];
};

type RegistrationRequestsListResponse = {
  requests: RegistrationRequestRecord[];
};

export function getAuthToken(): string {
  return window.localStorage.getItem(AUTH_TOKEN_KEY) || "";
}

export function getStoredAuthUser(): AuthUser | null {
  try {
    const raw = window.localStorage.getItem(AUTH_USER_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as AuthUser;
    if (!parsed || typeof parsed.id !== "number") {
      return null;
    }
    if (typeof parsed.is_superuser !== "boolean") {
      return { ...parsed, is_superuser: false };
    }
    return parsed;
  } catch {
    return null;
  }
}

function storeAuthSession(token: string, user: AuthUser): void {
  window.localStorage.setItem(AUTH_TOKEN_KEY, token);
  window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

function clearStoredAuthSession(): void {
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  window.localStorage.removeItem(AUTH_USER_KEY);
}

export async function loginWithPin(identifier: string, pin: string): Promise<AuthUser> {
  const response = await apiFetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, pin }),
  });
  if (!response.ok) {
    throw new Error("Invalid credentials");
  }
  const payload = (await response.json()) as { token: string; user: AuthUser };
  storeAuthSession(payload.token, payload.user);
  notifyOverviewStatsUpdated();
  return payload.user;
}

export async function submitRegistrationRequest(username: string, email: string): Promise<string> {
  const response = await apiFetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email }),
  });
  if (!response.ok) {
    let detail = "Failed to submit registration request";
    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload.detail) {
        detail = payload.detail;
      }
    } catch {
      // Keep default message.
    }
    throw new Error(detail);
  }
  const payload = (await response.json()) as RegistrationRequestResponse;
  return payload.message;
}

export async function createUserWithPin(username: string, email: string, pin: string): Promise<AuthUser> {
  const response = await apiFetch(`${API_BASE}/auth/admin-create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, pin }),
  });
  if (!response.ok) {
    let detail = "Failed to create user";
    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload.detail) {
        detail = payload.detail;
      }
    } catch {
      // Keep default message.
    }
    throw new Error(detail);
  }
  const payload = (await response.json()) as { user: AuthUser };
  return payload.user;
}

export async function resetUserPin(identifier: string, pin: string): Promise<AuthUser> {
  const response = await apiFetch(`${API_BASE}/auth/reset-pin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, pin }),
  });
  if (!response.ok) {
    let detail = "Failed to reset user PIN";
    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload.detail) {
        detail = payload.detail;
      }
    } catch {
      // Keep default message.
    }
    throw new Error(detail);
  }
  const payload = (await response.json()) as { user: AuthUser };
  return payload.user;
}

export async function logoutFromPinSession(): Promise<void> {
  await apiFetch(`${API_BASE}/auth/logout`, { method: "POST" });
  clearStoredAuthSession();
  notifyOverviewStatsUpdated();
}

export async function fetchAuthBootstrapStatus(): Promise<boolean> {
  const response = await apiFetch(`${API_BASE}/auth/bootstrap-status`);
  if (!response.ok) {
    return false;
  }
  const payload = (await response.json()) as AuthBootstrapStatusResponse;
  return Boolean(payload.can_public_register);
}

export async function fetchRegisteredUsers(): Promise<AuthUser[]> {
  const response = await apiFetch(`${API_BASE}/auth/users`);
  if (!response.ok) {
    let detail = "Failed to load registered users";
    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload.detail) {
        detail = payload.detail;
      }
    } catch {
      // Keep default message.
    }
    throw new Error(detail);
  }
  const payload = (await response.json()) as RegisteredUsersResponse;
  return payload.users;
}

export async function fetchRegistrationRequests(): Promise<RegistrationRequestRecord[]> {
  const response = await apiFetch(`${API_BASE}/auth/registration-requests`);
  if (!response.ok) {
    let detail = "Failed to load registration requests";
    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload.detail) {
        detail = payload.detail;
      }
    } catch {
      // Keep default message.
    }
    throw new Error(detail);
  }
  const payload = (await response.json()) as RegistrationRequestsListResponse;
  return payload.requests;
}
