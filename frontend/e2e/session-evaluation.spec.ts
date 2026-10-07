import { expect, test } from "@playwright/test";

for (const direction of ["es_to_de", "de_to_es"]) {
for (const correct of [true, false]) {
  test(`registered ${direction} evaluation survives save failure and reload: ${correct}`, async ({ page }) => {
    await page.setViewportSize(correct ? { width: 1280, height: 800 } : { width: 320, height: 568 });
    await page.addInitScript(() => localStorage.setItem("app_language", "en"));
    const entry = { id: 8, item_type: "pattern", mode: "review", direction, review_version: 0 };
    const evaluation = direction === "es_to_de" ? { id: "affix_production", content: {
      base: "möglich", base_translation: "posible", meaning: "la posibilidad",
      answer: "die Möglichkeit", highlight: [11, 15],
    } } : { id: "affix_recognition", content: {
      base: "möglich", base_translation: "posible", word: "die Möglichkeit", answer: "la posibilidad",
    } };
    const reviews: unknown[] = [];
    const requestedVersions: Array<string | null> = [];
    await page.route("**/api/**", async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === "/api/session") return route.fulfill({ json: { items: [entry] } });
      if (url.pathname === "/api/session/items/8") {
        requestedVersions.push(url.searchParams.get("review_version"));
        return route.fulfill({ json: {
          ...entry, german_text: "-keit", spanish_text: "Patrón", pattern_key: "german_suffix_keit", options: [],
          learning_evaluation: evaluation,
        } });
      }
      if (url.pathname === "/api/review") {
        reviews.push(request.postDataJSON());
        return route.fulfill({ status: reviews.length === 1 ? 503 : 200, json: { ok: reviews.length > 1 } });
      }
      return route.fulfill({ json: {} });
    });
    await page.goto("/e2e/fixtures/session.html");
    await page.getByRole("button", { name: "Start session", exact: true }).click();
    await expect(page.getByText("möglich", { exact: true })).toBeVisible();
    await expect(page.locator(".definition-evaluation-answer")).toHaveCount(0);
    await page.getByRole("button", { name: "Reveal answer" }).click();
    await expect(page.locator(".definition-evaluation-answer")).toHaveText(evaluation.content.answer);
    await page.getByRole("button", { name: correct ? "Passed" : "Failed", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Your result could not be saved.");
    await expect(page.getByRole("button", { name: "Next", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: correct ? "Passed" : "Failed", exact: true }).click();
    await expect(page.getByRole("button", { name: "Next", exact: true })).toBeVisible();
    await page.reload();
    await expect(page.locator(".definition-evaluation-answer")).toHaveText(evaluation.content.answer);
    await expect(page.getByRole("button", { name: "Reveal answer" })).toHaveCount(0);
    expect(reviews).toEqual(Array(2).fill({ item_id: 8, correct, direction, review_version: 0 }));
    expect(requestedVersions).toEqual(["0", "0"]);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByRole("button", { name: "Start another session" })).toBeVisible();
  });
}
}
