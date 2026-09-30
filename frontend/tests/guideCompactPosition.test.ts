import { expect, it } from "vitest";
import { compactGuidePosition } from "../src/guides/guidedTourPosition";

const viewport = { top: 0, left: 0, width: 390, height: 600 };
const target = (top: number, height = 44) => ({ top, bottom: top + height, left: 20, width: 350, height });

it("keeps a tall card below a high target and limits it to less than half the screen", () => {
  const { style, compact } = compactGuidePosition(target(80), viewport);
  expect(style.top).toBeGreaterThan(124);
  expect(style.maxHeight).toBeLessThanOrEqual(270);
  expect(style.top + style.maxHeight).toBeLessThanOrEqual(588);
  expect(compact).toBe(false);
});

it("places the card above a low target", () => {
  const { style } = compactGuidePosition(target(490), viewport);
  expect(style.top + style.maxHeight).toBeLessThan(490);
});

it("starts minimized if a large target leaves no readable card space", () => {
  const { compact } = compactGuidePosition(target(40, 520), viewport);
  expect(compact).toBe(true);
});

it("uses the visible viewport after zoom or keyboard changes", () => {
  const view = { top: 180, left: 100, width: 195, height: 300 };
  const { style, toggleStyle } = compactGuidePosition(target(220), view);
  expect(style.left).toBeGreaterThanOrEqual(view.left);
  expect(style.left + style.width).toBeLessThanOrEqual(view.left + view.width);
  expect(style.top).toBeGreaterThanOrEqual(view.top);
  expect(style.top + style.maxHeight).toBeLessThanOrEqual(view.top + view.height);
  expect(toggleStyle.top + 44).toBeLessThanOrEqual(view.top + view.height);
});
