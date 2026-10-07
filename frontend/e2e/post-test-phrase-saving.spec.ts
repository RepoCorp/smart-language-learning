import { expect, test } from "@playwright/test";

for (const partial of [false, true]) {
  test(`save post-test phrase without changing the session: partial=${partial}`, async ({ page }) => {
    await page.setViewportSize(partial ? { width: 320, height: 568 } : { width: 1280, height: 800 });
    await page.addInitScript(() => localStorage.setItem("app_language", "en"));
    const entry = { id: 8, item_type: "word", mode: "review", direction: "de_to_es" };
    const reviews: unknown[] = [];
    const saves: Array<Record<string, unknown>> = [];
    await page.route("**/api/**", async route => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (path === "/api/session") return route.fulfill({ json: { items: [entry] } });
      if (path === "/api/session/items/8") return route.fulfill({ json: {
        ...entry, german_text: "arbeiten", spanish_text: "trabajar", options: [],
        exercise_phrases: { phrases: [{ target_text: "Wir arbeiten hier.", source_text: "Trabajamos aquí." }] },
      } });
      if (path === "/api/review") {
        reviews.push(request.postDataJSON());
        return route.fulfill({ json: { ok: true } });
      }
      if (path === "/api/content/phrases/add") {
        const payload = request.postDataJSON();
        saves.push(payload);
        return route.fulfill({ json: { created: !payload.check_only, exists: false,
          id: payload.check_only ? null : 91, target_text: "Wir arbeiten", source_text: "Trabajamos" } });
      }
      if (path === "/api/content/items/91") return route.fulfill({ json: {
        id: 91, item_type: "phrase", german_text: partial ? "Wir arbeiten" : "Wir arbeiten hier.",
        spanish_text: "Trabajamos", item_questions: [], related_dialogs: [], exercise_phrases: {},
      } });
      return route.fulfill({ json: {} });
    });
    await page.goto("/e2e/fixtures/session.html");
    await page.getByRole("button", { name: "Start session", exact: true }).click();
    await page.getByRole("button", { name: "Reveal answer" }).click();
    await expect(page.getByRole("button", { name: "Save a phrase" })).toHaveCount(0);
    await page.getByRole("button", { name: "Passed", exact: true }).click();
    await page.getByRole("button", { name: "Save a phrase", exact: true }).click();
    if (partial) {
      await page.getByRole("button", { name: /Short expression/ }).click();
      await page.getByRole("button", { name: "Wir", exact: true }).click();
      await page.getByRole("button", { name: "arbeiten", exact: true }).click();
      await page.getByRole("button", { name: "Add expression", exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Add sentence", exact: true }).click();
    } else {
      await page.getByRole("button", { name: /Full line/ }).click();
    }
    const details = page.getByRole("dialog");
    await expect(details).toBeVisible();
    await details.getByRole("button", { name: "Close", exact: true }).click();
    await expect(details).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Next", exact: true })).toBeVisible();
    expect(reviews).toHaveLength(1);
    expect(saves[saves.length - 1]).toMatchObject({ check_only: false, target_text: partial ? "Wir arbeiten" : "Wir arbeiten hier." });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByRole("button", { name: "Start another session" })).toBeVisible();
    expect(reviews).toHaveLength(1);
  });
}
