import { expect, test } from "@playwright/test";

for (const language of ["en", "es"]) {
  for (const mobile of [false, true]) {
    test(`construction preview can be read and closed: ${language}, mobile=${mobile}`, async ({ page }) => {
      await page.setViewportSize(mobile ? { width: 320, height: 568 } : { width: 1280, height: 720 });
      await page.addInitScript((value) => localStorage.setItem("app_language", value), language);
      await page.route("**/api/construction-patterns", route => route.fulfill({ json: { id: 42, created: true } }));
      await page.goto("/e2e/fixtures/construction-preview.html");
      if (mobile) await page.evaluate(() => document.documentElement.style.fontSize = "200%");
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByText("werden + Infinitiv", { exact: true })).toBeVisible();
      await expect(dialog.getByRole("button")).toHaveCount(2);
      await dialog.getByRole("button", { name: language === "en" ? "Save pattern" : "Guardar patrón", exact: true }).click();
      await expect(dialog.getByRole("status")).toBeVisible();
      await dialog.getByRole("button", { name: language === "en" ? "Close" : "Cerrar", exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await expect(page.getByText("Closed preview")).toBeVisible();
    });

    test(`word confirmation offers -keit separately: ${language}, mobile=${mobile}`, async ({ page }) => {
      await page.setViewportSize(mobile ? { width: 320, height: 568 } : { width: 1280, height: 720 });
      await page.addInitScript(value => localStorage.setItem("app_language", value), language);
      let saves = 0;
      await page.route("**/api/word-formation**", async route => {
        if (route.request().method() === "POST") {
          expect(route.request().postDataJSON()).toEqual({ pattern_key: "german_suffix_keit", source_language: "spanish", target_language: "german" });
          saves++;
          await route.fulfill({ json: { id: 42, created: true } });
        } else await route.fulfill({ json: { supported: true, saved: [] } });
      });
      await page.goto("/e2e/fixtures/construction-preview.html?affix");
      if (mobile) await page.evaluate(() => document.documentElement.style.fontSize = "200%");
      const dialog = page.getByRole("dialog");
      const card = dialog.getByRole("article", { name: "-keit" });
      await expect(card).toBeVisible();
      await card.getByRole("button", { name: language === "en" ? "Save pattern" : "Guardar patrón" }).click();
      await expect(card.getByRole("button")).toBeDisabled();
      expect(saves).toBe(1);
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: language === "en" ? "Add" : "Agregar", exact: true }).click();
      await expect(dialog).toHaveCount(0);
    });
  }
}
