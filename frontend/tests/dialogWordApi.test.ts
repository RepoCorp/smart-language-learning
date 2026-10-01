import { expect, it, vi } from "vitest";
import { quickAddWordFromDialog } from "../src/api";
import { apiFetch } from "../src/apiCore";

vi.mock("../src/apiCore", () => ({ API_BASE: "/api", apiFetch: vi.fn(), notifyOverviewStatsUpdated: vi.fn() }));

it("sends the clicked token and full context for preview without saving", async () => {
  vi.mocked(apiFetch).mockResolvedValue(new Response(JSON.stringify({ created: false, exists: false, target_text: "kommen" })));
  const result = await quickAddWordFromDialog("kommt", "kommt", "spanish", "german", 4, 0, true, "Viene.", "Er kommt.", "kommt");
  expect(result.target_text).toBe("kommen");
  const calls = vi.mocked(apiFetch).mock.calls;
  const [url, options] = calls[calls.length - 1];
  expect(url).toContain("/content/words/add?source_language=spanish&target_language=german");
  expect(JSON.parse(options!.body as string)).toMatchObject({ check_only: true, dialog_id: 4, turn_index: 0, clicked_target_token: "kommt", target_line: "Er kommt." });
});

it("surfaces unsuccessful responses", async () => {
  vi.mocked(apiFetch).mockResolvedValue(new Response("", { status: 503 }));
  await expect(quickAddWordFromDialog("word", "word")).rejects.toThrow();
});
