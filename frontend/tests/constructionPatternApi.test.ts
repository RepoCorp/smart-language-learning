import { beforeEach, expect, it, vi } from "vitest";
import { saveConstructionPattern } from "../src/apiConstructionPatterns";
import { apiFetch, notifyOverviewStatsUpdated } from "../src/apiCore";

vi.mock("../src/apiCore", () => ({ API_BASE: "/api", apiFetch: vi.fn(), notifyOverviewStatsUpdated: vi.fn() }));
beforeEach(() => vi.clearAllMocks());

it("saves the signed preview and updates stats only after success", async () => {
  vi.mocked(apiFetch).mockResolvedValue(new Response(JSON.stringify({ id: 42, created: true })));
  expect(await saveConstructionPattern("signed-preview")).toBe(42);
  expect(apiFetch).toHaveBeenCalledWith("/api/construction-patterns", expect.objectContaining({
    method: "POST", body: JSON.stringify({ save_token: "signed-preview" }),
  }));
  expect(notifyOverviewStatsUpdated).toHaveBeenCalledOnce();
});

it.each([400, 401, 500])("does not claim success for HTTP %s", async status => {
  vi.mocked(apiFetch).mockResolvedValue(new Response("", { status }));
  await expect(saveConstructionPattern("token")).rejects.toThrow();
  expect(notifyOverviewStatsUpdated).not.toHaveBeenCalled();
});

it("rejects a success response without a valid saved item", async () => {
  vi.mocked(apiFetch).mockResolvedValue(new Response("{}"));
  await expect(saveConstructionPattern("token")).rejects.toThrow();
  expect(notifyOverviewStatsUpdated).not.toHaveBeenCalled();
});
