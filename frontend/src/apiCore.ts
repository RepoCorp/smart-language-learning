const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
const OVERVIEW_STATS_UPDATED_EVENT = "overview-stats-updated";

function apiRequestSummary(input: string, init?: RequestInit): { method: string; url: string } {
  return {
    method: init?.method || "GET",
    url: typeof input === "string" ? input : input.toString(),
  };
}

function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const token = window.localStorage.getItem("smart-language-learning-auth-token") || "";
  const headers = new Headers(init?.headers || {});
  headers.set("Accept", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const request = apiRequestSummary(input, init);
  return fetch(input, { ...init, headers })
    .then((response) => {
      if (!response.ok) {
        console.error("Backend request failed", {
          ...request,
          status: response.status,
          statusText: response.statusText,
        });
      }
      const contentType = response.headers.get("Content-Type") || "";
      if (response.ok && contentType.includes("text/html")) {
        console.error("Backend request returned HTML instead of JSON. Check VITE_API_URL/BACKEND_API_URL and ALB routing.", {
          ...request,
          status: response.status,
          contentType,
        });
      }
      return response;
    })
    .catch((error) => {
      console.error("Backend request error", {
        ...request,
        error,
      });
      throw error;
    });
}

function notifyOverviewStatsUpdated(): void {
  window.dispatchEvent(new CustomEvent(OVERVIEW_STATS_UPDATED_EVENT));
}

function getOverviewStatsUpdatedEventName(): string {
  return OVERVIEW_STATS_UPDATED_EVENT;
}

export {
  API_BASE,
  apiFetch,
  getOverviewStatsUpdatedEventName,
  notifyOverviewStatsUpdated,
};
