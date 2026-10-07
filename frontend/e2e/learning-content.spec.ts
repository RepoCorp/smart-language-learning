import { expect, test } from "@playwright/test";
import { keit } from "../tests/learningContent/fixtures";

for (const language of ["en", "es"]) {
  for (const mobile of [false, true]) {
    test(`learning playground: ${language}, mobile=${mobile}`, async ({ page }) => {
      await page.setViewportSize(mobile ? { width: 320, height: 568 } : { width: 1280, height: 800 });
      await page.addInitScript(value => localStorage.setItem("app_language", value), language);
      const requests: string[] = [];
      await page.route("**/api/**", async route => {
        requests.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`);
        await route.fulfill({ json: { definitions: [keit] } });
      });
      await page.goto("/e2e/fixtures/learning-content.html");
      if (mobile) await page.evaluate(() => document.documentElement.style.fontSize = "200%");
      await expect(page.getByRole("heading", { name: "-keit", exact: true })).toBeVisible();
      const actions = page.locator(".item-actions-toolbar button");
      await expect(actions).toHaveCount(5);
      await expect(actions.first()).toBeEnabled();
      await expect(actions.nth(1)).toBeEnabled();
      for (const button of (await actions.all()).slice(2)) await expect(button).toBeDisabled();
      await expect(page.getByRole("listitem")).toHaveCount(2);
      await actions.first().click();
      const modal = page.getByRole("dialog", { name: language === "en" ? "Strategies" : "Estrategias" });
      await expect(modal).toBeVisible();
      await expect(modal.getByRole("combobox")).toHaveValue("affix_examples");
      await expect(modal.getByRole("option")).toHaveText(language === "en" ? "Examples" : "Ejemplos");
      await expect(modal.getByRole("listitem")).toHaveCount(6);
      await modal.getByRole("listitem").last().scrollIntoViewIfNeeded();
      await expect(modal.getByRole("listitem").last()).toContainText("einsam → die Einsamkeit");
      await expect(modal.getByRole("listitem").last().locator("strong")).toHaveText("keit");
      expect(await modal.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await modal.getByRole("button", { name: language === "en" ? "Close" : "Cerrar" }).click();
      await expect(modal).toHaveCount(0);
      await expect(actions.first()).toBeFocused();
      await expect(page.getByRole("listitem")).toHaveCount(2);
      await actions.first().click();
      await page.keyboard.press("Escape");
      await expect(modal).toHaveCount(0);
      await actions.nth(1).click();
      const evaluation = page.getByRole("dialog", { name: language === "en" ? "Testing" : "Pruebas" });
      await expect(evaluation).toBeVisible();
      await expect(evaluation.getByRole("option")).toHaveText(language === "en"
        ? ["Build a word", "Understand a word"] : ["Forma una palabra", "Comprende una palabra"]);
      const picker = evaluation.getByRole("combobox");
      expect(await picker.evaluate(element => {
        const bounds = element.getBoundingClientRect();
        const parent = element.parentElement!.getBoundingClientRect();
        return bounds.left >= parent.left && bounds.right <= parent.right + 1;
      })).toBe(true);
      await expect(evaluation).toContainText("«la posibilidad»");
      await expect(evaluation).not.toContainText("Möglichkeit");
      await evaluation.getByRole("button", { name: language === "en" ? "Reveal answer" : "Mostrar respuesta" }).click();
      await expect(evaluation).toContainText("die Möglichkeit");
      await evaluation.getByRole("button", { name: language === "en" ? "Passed" : "Acertado" }).click();
      await evaluation.getByRole("button", { name: language === "en" ? "Next example" : "Siguiente ejemplo" }).click();
      await expect(evaluation).toContainText("«la limpieza»");
      await expect(evaluation).not.toContainText("Sauberkeit");
      await picker.selectOption("target_to_source");
      await expect(evaluation).toContainText("die Möglichkeit");
      await expect(evaluation).not.toContainText("la posibilidad");
      await evaluation.getByRole("button", { name: language === "en" ? "Reveal answer" : "Mostrar respuesta" }).click();
      await expect(evaluation).toContainText("la posibilidad");
      await evaluation.getByRole("button", { name: language === "en" ? "Failed" : "Fallado" }).click();
      await evaluation.getByRole("button", { name: language === "en" ? "Next example" : "Siguiente ejemplo" }).click();
      await expect(evaluation).toContainText("die Sauberkeit");
      await expect(evaluation).not.toContainText("la limpieza");
      expect(await evaluation.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await evaluation.getByRole("button", { name: language === "en" ? "Close" : "Cerrar" }).click();
      await expect(actions.nth(1)).toBeFocused();
      expect(requests).toEqual(["GET /api/admin/learning-content"]);
      await expect(page.getByText("posible → la posibilidad", { exact: true })).toBeVisible();
      await page.getByLabel(language === "en" ? "Narrow preview" : "Vista estrecha").check();
      const metadata = page.locator(".item-view-meta-card");
      await expect.poll(async () => {
        const type = await metadata.nth(0).boundingBox();
        const notes = await metadata.nth(1).boundingBox();
        return !!type && !!notes && notes.y >= type.y + type.height;
      }).toBe(true);
      if (!mobile) {
        await page.getByLabel(language === "en" ? "Narrow preview" : "Vista estrecha").uncheck();
        await expect.poll(async () => {
          const type = await metadata.nth(0).boundingBox();
          const notes = await metadata.nth(1).boundingBox();
          return !!type && !!notes && Math.abs(notes.y - type.y) < 1 && notes.x > type.x;
        }).toBe(true);
        await page.getByLabel(language === "en" ? "Narrow preview" : "Vista estrecha").check();
      }
      await page.getByLabel(language === "en" ? "Translation language" : "Idioma de las traducciones").selectOption("english");
      await expect(page.getByText("possible → the possibility", { exact: true })).toBeVisible();
      await page.getByText(language === "en" ? "Definition data" : "Datos de la definición", { exact: true }).click();
      await expect(page.locator("pre")).toContainText("german_suffix_keit");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      await page.getByRole("button", { name: language === "en" ? "Reload definitions" : "Recargar definiciones" }).click();
      await expect(page.getByRole("heading", { name: "-keit", exact: true })).toBeVisible();
      expect(requests).toEqual(["GET /api/admin/learning-content", "GET /api/admin/learning-content"]);
      const preview = page.getByRole("region", { name: language === "en" ? "Item view preview" : "Vista previa del elemento" });
      await preview.evaluate(element => element.scrollTop = element.scrollHeight);
      await page.getByRole("button", { name: language === "en" ? "Close" : "Cerrar", exact: true }).click();
      await expect(preview).toHaveCount(0);
      await page.getByRole("button", { name: language === "en" ? "Open item view" : "Abrir vista del elemento" }).click();
      await expect(page.getByRole("heading", { name: "-keit", exact: true })).toBeVisible();
      expect(requests).toHaveLength(2);
    });
  }
}
