import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("app_language")) localStorage.setItem("app_language", "en");
  });
  await page.goto("/e2e/fixtures/guide.html");
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
});

test("large instructions scroll without blocking the required action", async ({ page }) => {
  const card = page.locator(".guided-tour-popover");
  await expect(card).toBeVisible();
  await expect.poll(() => card.evaluate(el => el.getBoundingClientRect().height)).toBeLessThanOrEqual(568 * 0.45);
  const body = page.locator(".guided-tour-card-body");
  expect(await body.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
  await body.evaluate(el => { el.scrollTop = el.scrollHeight; });
  expect(await body.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  await expect(page.getByRole("button", { name: "Minimize guide" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const target = document.querySelector("[data-guide-target] button")!;
    const box = target.getBoundingClientRect();
    return target.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2));
  })).toBe(true);
  await page.getByRole("button", { name: "Generate goal", exact: true }).tap();
  await expect(page.getByTestId("actions")).toHaveText("1");
  await expect(page.getByTestId("advanced")).toHaveText("1");
});

test("minimizing and reopening does not skip the action-based step", async ({ page }) => {
  await page.getByRole("button", { name: "Minimize guide" }).tap();
  await expect(page.locator(".guided-tour-popover")).toHaveCount(0);
  await expect(page.getByTestId("advanced")).toHaveText("0");
  await page.getByRole("button", { name: /Show guide:/ }).tap();
  await expect(page.getByRole("heading", { name: "Generate a small goal" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Next", exact: true })).toHaveCount(0);
  await expect(page.getByTestId("advanced")).toHaveText("0");
});

test("a target filling the screen leaves the guide minimized and recoverable", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide.html?tall=1");
  await page.getByRole("button", { name: /Show guide:/ }).tap();
  await expect(page.locator(".guided-tour-popover")).toBeVisible();
  await page.getByRole("button", { name: "Minimize guide" }).tap();
  await page.getByRole("button", { name: "Generate goal", exact: true }).tap();
  await expect(page.getByTestId("advanced")).toHaveText("1");
});

test("more information and the final action remain reachable at large text size", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide.html?step=conversation-flow");
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  await page.getByRole("button", { name: "More information" }).tap();
  await expect(page.locator(".guided-tour-more-info")).toBeVisible();
  await page.getByRole("button", { name: "I am ready to try it" }).tap();
  await expect(page.getByTestId("advanced")).toHaveText("1");
});

test("guide controls stay within the visible area when zoomed", async ({ page, context }) => {
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 });
  const reopen = page.getByRole("button", { name: /Show guide:/ });
  if (await reopen.count()) await reopen.tap();
  await expect.poll(() => page.getByRole("button", { name: "Minimize guide" }).evaluate(el => {
    const box = el.getBoundingClientRect();
    const view = window.visualViewport!;
    return box.left >= view.offsetLeft && box.right <= view.offsetLeft + view.width
      && box.top >= view.offsetTop && box.bottom <= view.offsetTop + view.height;
  })).toBe(true);
  expect(await page.locator(".guided-tour-card-body").evaluate(el => el.clientHeight)).toBeGreaterThan(24);
  await page.getByRole("button", { name: "Minimize guide" }).tap();
  await expect(reopen).toBeVisible();
});

test("minimize and reopen controls are localized", async ({ page }) => {
  await page.evaluate(() => localStorage.setItem("app_language", "es"));
  await page.reload();
  await page.getByRole("button", { name: "Minimizar guía" }).tap();
  await page.getByRole("button", { name: /Mostrar guía:/ }).tap();
  await expect(page.getByRole("heading", { name: "Genera un objetivo pequeño" })).toBeVisible();
});
