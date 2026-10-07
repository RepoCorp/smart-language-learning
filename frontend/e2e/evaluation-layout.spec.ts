import { expect, test } from "@playwright/test";
import { keit } from "../tests/learningContent/fixtures";

for (const mobile of [false, true]) {
  test(`evaluation spacing mobile=${mobile}`, async ({ page }, testInfo) => {
    await page.setViewportSize(mobile ? { width: 320, height: 568 } : { width: 1280, height: 800 });
    await page.addInitScript(() => localStorage.setItem("app_language", "en"));
    await page.route("**/api/**", route => route.fulfill({ json: { definitions: [keit] } }));
    await page.goto("/e2e/fixtures/learning-content.html");
    if (mobile) await page.evaluate(() => document.documentElement.style.fontSize = "200%");
    await page.getByRole("button", { name: "Open testing" }).click();
    const modal = page.getByRole("dialog", { name: "Testing" });
    await expect(modal).toBeVisible();
    const heading = await modal.getByRole("heading", { name: "Testing" }).boundingBox();
    const close = await modal.getByRole("button", { name: "Close" }).boundingBox();
    expect(heading).not.toBeNull();
    expect(close).not.toBeNull();
    expect(Math.abs((heading!.y + heading!.height / 2) - (close!.y + close!.height / 2))).toBeLessThan(2);
    expect(await modal.locator(".definition-evaluation-prompt").evaluate(element => getComputedStyle(element).rowGap)).toBe(mobile ? "16px" : "8px");
    expect(await modal.locator(".actions").evaluate(element => getComputedStyle(element).marginTop)).toBe("0px");
    await page.screenshot({ path: testInfo.outputPath("question.png") });
    await modal.getByRole("button", { name: "Reveal answer" }).click();
    await expect(modal.locator(".definition-evaluation-answer")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("answer.png") });
    await modal.getByRole("button", { name: "Passed" }).click();
    await expect(modal.getByRole("status")).toHaveText("Passed");
    await page.screenshot({ path: testInfo.outputPath("completed.png") });
    expect(await modal.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await modal.getByRole("button", { name: "Close" }).click();
    await expect(modal).toHaveCount(0);
  });
}
