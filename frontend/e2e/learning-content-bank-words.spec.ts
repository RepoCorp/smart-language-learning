import { expect, test } from "@playwright/test";
import { keit } from "../tests/learningContent/fixtures";

for (const language of ["en", "es"] as const) {
  test(`bank words strategy: ${language}, narrow layout and large text`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.addInitScript(value => localStorage.setItem("app_language", value), language);
    const calls: URL[] = [];
    await page.route("**/api/**", async route => {
      expect(route.request().method()).toBe("GET");
      const url = new URL(route.request().url());
      if (url.pathname === "/api/admin/learning-content") {
        await route.fulfill({ json: { definitions: [keit] } });
        return;
      }
      expect(url.pathname).toBe("/api/learning-content/german_suffix_keit/strategies/affix_bank_words/words");
      expect(url.searchParams.get("source_language")).toBe("spanish");
      calls.push(url);
      const second = url.searchParams.get("offset") === "20";
      await route.fulfill({ json: {
        words: second ? [{ id: 21, text: "die Freundlichkeit", translation: "la amabilidad" }]
          : Array.from({ length: 20 }, (_, i) => ({ id: i + 1, text: "die Möglichkeit", translation: "la posibilidad" })),
        next_offset: second ? null : 20,
      } });
    });
    await page.goto("/e2e/fixtures/learning-content.html");
    await page.evaluate(() => document.documentElement.style.fontSize = "200%");
    const open = page.getByRole("button", { name: language === "en" ? "Open strategies" : "Abrir estrategias" });
    await open.click();
    const modal = page.getByRole("dialog");
    expect(calls).toHaveLength(0);
    await modal.getByRole("combobox").selectOption("affix_bank_words");
    await expect(modal.getByRole("heading", { name: language === "en" ? "Your words" : "Tus palabras" })).toBeVisible();
    await expect(modal.getByRole("listitem")).toHaveCount(20);
    await expect(modal.getByRole("listitem").first()).toHaveText("die Möglichkeitla posibilidad");
    await modal.getByRole("button", { name: language === "en" ? "Show more words" : "Mostrar más palabras" }).click();
    await expect(modal.getByRole("listitem")).toHaveCount(21);
    await modal.getByRole("listitem").last().scrollIntoViewIfNeeded();
    await expect(modal.getByRole("listitem").last()).toContainText("die Freundlichkeit");
    expect(await modal.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    expect(calls.map(url => url.searchParams.get("offset"))).toEqual(["0", "20"]);
    await modal.getByRole("combobox").selectOption("affix_examples");
    await expect(modal.getByRole("listitem")).toHaveCount(6);
    expect(calls).toHaveLength(2);
    await modal.getByRole("button", { name: language === "en" ? "Close" : "Cerrar" }).click();
    await expect(modal).toHaveCount(0);
    await expect(open).toBeFocused();
  });
}
