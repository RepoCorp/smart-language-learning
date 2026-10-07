import { API_BASE, apiFetch } from "../../../apiCore";
import { isLearningDefinition, type LearningDefinition } from "../definition";

export class CatalogRequestError extends Error {
  constructor(public readonly kind: "connection" | "permission" | "endpoint" | "response" | "server", public readonly status?: number) {
    super(`Catalog request failed: ${kind}${status ? ` (${status})` : ""}`);
  }
}

export async function fetchDefinitions(signal: AbortSignal): Promise<LearningDefinition[]> {
  let response: Response;
  try {
    response = await apiFetch(`${API_BASE}/admin/learning-content`, { signal, cache: "no-store" });
  } catch {
    throw new CatalogRequestError("connection");
  }
  if (!response.ok) {
    const kind = response.status === 401 || response.status === 403 ? "permission"
      : response.status === 404 ? "endpoint" : "server";
    throw new CatalogRequestError(kind, response.status);
  }
  const payload = await response.json().catch(() => { throw new CatalogRequestError("response", response.status); });
  if (!payload || !Array.isArray(payload.definitions) || !payload.definitions.every(isLearningDefinition)) {
    throw new CatalogRequestError("response", response.status);
  }
  return payload.definitions;
}
