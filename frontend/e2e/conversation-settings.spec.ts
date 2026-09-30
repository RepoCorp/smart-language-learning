import { expect, test } from "@playwright/test";

for (const width of [390, 1280]) {
  for (const language of ["en", "es"]) {
    test(`conversation settings at ${width}px in ${language}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.addInitScript(lang => localStorage.setItem("app_language", lang), language);
      await page.route("**/api/**", route => route.fulfill({ json: route.request().url().includes("goal-regenerate")
        ? { goal_text: "Buy bread", topic: "Shopping" } : { topics: ["Shopping"] } }));
      await page.goto("/e2e/fixtures/conversation.html");
      const more = page.locator("summary", { hasText: language === "en" ? "More controls" : "Más controles" });
      const start = page.getByRole("button", { name: language === "en" ? "Start conversation" : "Iniciar conversación", exact: true });
      await expect(start).toBeDisabled();
      await more.click();
      const option = page.locator(".conversation-secondary-controls .exercise-radio-option").first();
      const dimensions = await option.evaluate(el => ({
        height: el.getBoundingClientRect().height,
        fontSize: parseFloat(getComputedStyle(el).fontSize),
      }));
      expect(dimensions.fontSize).toBeLessThanOrEqual(14);
      expect(dimensions.height).toBeGreaterThanOrEqual(32);
      expect(dimensions.height).toBeLessThanOrEqual(36);
      await page.getByRole("radio", { name: language === "en" ? "Absolute beginner" : "Principiante absoluto", exact: true }).check();
      await expect(page.getByRole("radio", { name: language === "en" ? "Super slow" : "Muy lenta", exact: true })).toBeChecked();
      await expect(page.getByRole("button", { name: /Ask help|Pedir ayuda/ })).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await more.click();
      await page.getByRole("button", { name: language === "en" ? "Generate goal" : "Generar objetivo", exact: true }).click();
      await expect(start).toBeEnabled();
      if (width === 390 && language === "en") await page.screenshot({ path: "/tmp/wls-conversation-settings.png", fullPage: true });
      await page.reload();
      await more.click();
      await expect(page.getByRole("radio", { name: language === "en" ? "Absolute beginner" : "Principiante absoluto", exact: true })).toBeChecked();
    });
  }
}
