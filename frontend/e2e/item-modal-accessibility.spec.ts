import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", route => route.fulfill({ json: {
    id: 71, item_type: "word", mode: "new", word_type: "adjective",
    german_text: "klein", spanish_text: "small", options: [],
    notes: "A useful example sentence. ".repeat(150),
  } }));
  await page.goto("/e2e/fixtures/item-modal.html");
});

test("tappable language text inherits sentence size and grows with preferred text size", async ({ page }) => {
  const token = page.getByRole("button", { name: "klein.", exact: true });
  const size = () => token.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
  const initial = await size();
  const sentenceSize = await page.locator(".dialog-target-line .target-phrase-text-dialog").first().evaluate(el => parseFloat(getComputedStyle(el).fontSize));
  expect(initial).toBe(sentenceSize);
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  expect(await size()).toBeCloseTo(initial * 2);
});

test("text sizing leaves translations, read-only text, hints, and controls unchanged", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const unchanged = [
    page.getByText("That is small.", { exact: true }),
    page.getByTestId("readonly-dialog").locator(".target-phrase-text"),
    page.getByTestId("audio-only-dialog").locator(".target-phrase-text"),
    page.getByTestId("revealed-answer").locator(".revealed-answer-main"),
    page.getByRole("button", { name: "Open item", exact: true }),
  ];
  const sizes = await Promise.all(unchanged.map(el => el.evaluate(node => getComputedStyle(node).fontSize)));
  const word = page.getByRole("button", { name: "Hallo!", exact: true });
  const initial = await word.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
  await page.getByRole("combobox", { name: /text size/ }).selectOption("2");
  expect(await word.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeCloseTo(initial * 2);
  for (let i = 0; i < unchanged.length; i++) await expect(unchanged[i]).toHaveCSS("font-size", sizes[i]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("the cross-browser text-size setting enlarges words and survives a reload", async ({ page }) => {
  const token = page.getByRole("button", { name: "klein.", exact: true });
  const original = await token.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
  const control = page.getByRole("button", { name: "Open item", exact: true });
  const controlSize = await control.evaluate(el => getComputedStyle(el).fontSize);
  await page.getByRole("combobox", { name: "Tappable text size" }).selectOption("2");
  expect(await token.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeCloseTo(original * 2);
  await expect(control).toHaveCSS("font-size", controlSize);
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Tappable text size" })).toHaveValue("2");
  expect(await token.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeCloseTo(original * 2);
  await token.click();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test.describe("mobile zoom and large text", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("can open and close an item at 200% pinch zoom", async ({ page, context }) => {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 });
    await page.getByRole("button", { name: "klein.", exact: true }).tap();
    const modal = page.locator(".words-item-modal");
    await expect(modal).toBeVisible();
    await expect.poll(() => page.evaluate(() => {
      const box = document.querySelector(".modal-corner-close")!.getBoundingClientRect();
      const view = window.visualViewport!;
      return box.left >= view.offsetLeft && box.right <= view.offsetLeft + view.width
        && box.top >= view.offsetTop && box.bottom <= view.offsetTop + view.height;
    })).toBe(true);
    await expect(page.locator(".blocking-modal-overlay")).not.toHaveCSS("touch-action", "none");
    await expect(modal).toHaveCSS("touch-action", "auto");
    await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 });
    await expect.poll(() => page.locator(".blocking-modal-overlay").evaluate(el => el.getBoundingClientRect().width)).toBeCloseTo(390);
    await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 });
    await expect.poll(() => page.locator(".blocking-modal-overlay").evaluate(el => el.getBoundingClientRect().width)).toBeCloseTo(195);
    await page.getByRole("button", { name: "Close", exact: true }).tap();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(await page.evaluate(() => window.visualViewport!.scale)).toBeCloseTo(2);
  });

  test("wraps enlarged tappable words on a narrow screen without hiding the close control", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    await page.getByRole("button", { name: "klein.", exact: true }).tap();
    const close = page.getByRole("button", { name: "Close", exact: true });
    await expect(close).toBeVisible();
    expect(await page.locator(".words-item-modal").evaluate(el => el.getBoundingClientRect().right)).toBeLessThanOrEqual(320);
    await page.screenshot({ path: "/tmp/wls-item-large-text.png" });
    await close.tap();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("keeps Close reachable while scrolling a long item at enlarged text size", async ({ page }) => {
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    await page.getByRole("button", { name: "klein.", exact: true }).tap();
    const modal = page.locator(".words-item-modal");
    await modal.evaluate(el => { el.scrollTop = el.scrollHeight; });
    expect(await modal.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
    await expect.poll(() => page.getByRole("button", { name: "Close", exact: true }).evaluate(el => {
      const box = el.getBoundingClientRect();
      return box.top >= 0 && box.right <= window.innerWidth && box.bottom <= window.innerHeight;
    })).toBe(true);
    await page.getByRole("button", { name: "Close", exact: true }).tap();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("does not reset the learner's zoom when leaving an input", async ({ page, context }) => {
    await page.goto("/");
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 });
    const changes = await page.evaluate(async () => {
      const meta = document.querySelector('meta[name="viewport"]')!;
      const observed: string[] = [];
      const observer = new MutationObserver(records => records.forEach(record => observed.push(record.oldValue || "")));
      observer.observe(meta, { attributes: true, attributeOldValue: true });
      document.querySelector("input")!.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 50));
      observer.disconnect();
      return observed;
    });
    expect(changes).toEqual([]);
  });
});

test("opens the real item modal and closes it without changing the item", async ({ page }) => {
  await page.getByRole("button", { name: "Open item", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("klein", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Open item", exact: true }).click();
  await expect(page.getByText("klein", { exact: true })).toBeVisible();
});
