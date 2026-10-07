import { expect, test } from "@playwright/test";
import { keit, phrase, word } from "../tests/learningContent/fixtures";

for (const language of ["en", "es"] as const) {
  for (const mobile of [false, true]) {
    test(`word and phrase previews: ${language}, mobile=${mobile}`, async ({ page }) => {
      await page.setViewportSize(mobile ? { width: 320, height: 568 } : { width: 1280, height: 800 });
      await page.addInitScript(value => localStorage.setItem("app_language", value), language);
      const requests: string[] = [];
      await page.route("**/api/**", async route => {
        requests.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`);
        await route.fulfill({ json: { definitions: [keit, word, phrase] } });
      });
      await page.goto("/e2e/fixtures/learning-content.html");
      if (mobile) await page.evaluate(() => document.documentElement.style.fontSize = "200%");
      const selector = page.getByLabel(language === "en" ? "Definition" : "Definición");
      await expect(selector.getByRole("option")).toHaveText(["-keit", word.text, phrase.text]);
      for (const definition of [word, phrase]) {
        await selector.selectOption(definition.key);
        const preview = page.getByRole("region", { name: language === "en" ? "Item view preview" : "Vista previa del elemento" });
        const heading = preview.getByRole("heading", { name: definition.text, exact: true });
        const close = preview.getByRole("button", { name: language === "en" ? "Close" : "Cerrar", exact: true });
        await heading.scrollIntoViewIfNeeded();
        await expect(heading).toBeVisible();
        await expect(preview.locator(".item-view-subtitle")).toHaveText(definition.translations.spanish!);
        await expect(close).toBeVisible();
        const headingBox = (await heading.boundingBox())!;
        const closeBox = (await close.boundingBox())!;
        expect(headingBox.x + headingBox.width).toBeLessThanOrEqual(closeBox.x);
        expect(closeBox.height).toBeGreaterThanOrEqual(44);
        expect(await preview.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
        for (const action of await preview.locator(".item-actions-toolbar button").all()) await expect(action).toBeDisabled();
        await preview.evaluate(element => element.scrollTop = element.scrollHeight);
        await close.click();
        await expect(preview).toHaveCount(0);
        await page.getByRole("button", { name: language === "en" ? "Open item view" : "Abrir vista del elemento" }).click();
        await expect(heading).toBeVisible();
      }
      await page.getByLabel(language === "en" ? "Translation language" : "Idioma de las traducciones").selectOption("english");
      await expect(page.locator(".item-view-subtitle")).toHaveText(phrase.translations.english!);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      expect(requests).toEqual(["GET /api/admin/learning-content"]);
      await page.getByRole("heading", { name: phrase.text, exact: true }).scrollIntoViewIfNeeded();
    });
  }
}
