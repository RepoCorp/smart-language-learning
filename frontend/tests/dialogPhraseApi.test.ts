import { beforeEach, expect, it, vi } from "vitest";
import { quickAddPhraseFromConversation } from "../src/api";
import { apiFetch, notifyOverviewStatsUpdated } from "../src/apiCore";

vi.mock("../src/apiCore", () => ({ API_BASE: "/api", apiFetch: vi.fn(), notifyOverviewStatsUpdated: vi.fn() }));
beforeEach(() => vi.clearAllMocks());

it.each([false, true])("preserves selected text, language pair and original context when checkOnly=%s", async checkOnly => {
  const response = { created: !checkOnly, exists: false, source_text: "Trabajamos", target_text: "Wir arbeiten" };
  vi.mocked(apiFetch).mockResolvedValue(Response.json(response));
  expect(await quickAddPhraseFromConversation("Trabajamos", "Wir arbeiten", "spanish", "german", checkOnly,
    4, 2, "Trabajamos aquí.", "Wir arbeiten hier.")).toEqual(response);
  const [url, options] = vi.mocked(apiFetch).mock.calls[0];
  expect(url).toBe("/api/content/phrases/add?source_language=spanish&target_language=german");
  expect(options!.method).toBe("POST");
  expect(JSON.parse(options!.body as string)).toEqual({
    source_text: "Trabajamos", target_text: "Wir arbeiten", notes: "", check_only: checkOnly,
    dialog_id: 4, turn_index: 2, source_line: "Trabajamos aquí.", target_line: "Wir arbeiten hier.",
  });
  expect(notifyOverviewStatsUpdated).toHaveBeenCalledOnce();
});

it.each([
  [JSON.stringify({ detail: "Could not translate selected phrase" }), "Could not translate selected phrase"],
  ["Not JSON", "Failed to add phrase from conversation"],
])("surfaces failed saves without notifying a change: %s", async (body, message) => {
  vi.mocked(apiFetch).mockResolvedValue(new Response(body, { status: 503 }));
  await expect(quickAddPhraseFromConversation("", "Wir arbeiten")).rejects.toThrow(message);
  expect(notifyOverviewStatsUpdated).not.toHaveBeenCalled();
});
