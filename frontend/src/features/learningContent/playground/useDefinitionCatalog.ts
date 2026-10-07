import { useEffect, useState } from "react";
import type { LearningDefinition } from "../definition";
import { CatalogRequestError, fetchDefinitions } from "./api";

export function useDefinitionCatalog() {
  const [definitions, setDefinitions] = useState<LearningDefinition[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<CatalogRequestError | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    setError(null);
    fetchDefinitions(controller.signal).then(data => {
      if (controller.signal.aborted) return;
      setDefinitions(data);
      setStatus("ready");
    }).catch((reason: unknown) => {
      if (controller.signal.aborted) return;
      setError(reason instanceof CatalogRequestError ? reason : new CatalogRequestError("response"));
      setStatus("error");
    });
    return () => controller.abort();
  }, [version]);

  return { definitions, status, error, reload: () => setVersion(value => value + 1) };
}
