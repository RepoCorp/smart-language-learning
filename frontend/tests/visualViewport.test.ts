import { afterEach, expect, it, vi } from "vitest";
import { installVisualViewportSizing } from "../src/accessibility/visualViewport";

afterEach(() => { vi.unstubAllGlobals(); document.documentElement.removeAttribute("style"); });

it("tracks zoom, panning and keyboard resizing without changing the zoom scale", () => {
  const viewport = Object.assign(new EventTarget(), {
    offsetTop: 80, offsetLeft: 40, width: 195, height: 422, scale: 2,
  });
  vi.stubGlobal("visualViewport", viewport);
  const cleanup = installVisualViewportSizing();
  const style = document.documentElement.style;
  expect(style.getPropertyValue("--visible-top")).toBe("80px");
  expect(style.getPropertyValue("--visible-left")).toBe("40px");
  expect(style.getPropertyValue("--visible-width")).toBe("195px");
  viewport.height = 200;
  viewport.dispatchEvent(new Event("resize"));
  expect(style.getPropertyValue("--visible-height")).toBe("200px");
  viewport.offsetLeft = 75;
  viewport.dispatchEvent(new Event("scroll"));
  expect(style.getPropertyValue("--visible-left")).toBe("75px");
  expect(viewport.scale).toBe(2);
  cleanup();
});

it("removes listeners and restores previous CSS values when disposed", () => {
  const viewport = Object.assign(new EventTarget(), { offsetTop: 0, offsetLeft: 0, width: 390, height: 844 });
  vi.stubGlobal("visualViewport", viewport);
  const style = document.documentElement.style;
  style.setProperty("--visible-top", "2px");
  const cleanup = installVisualViewportSizing();
  cleanup();
  viewport.dispatchEvent(new Event("resize"));
  viewport.dispatchEvent(new Event("scroll"));
  expect(style.getPropertyValue("--visible-top")).toBe("2px");
  expect(style.getPropertyValue("--visible-width")).toBe("");
});

it("leaves CSS viewport sizing in place when VisualViewport is unavailable", () => {
  vi.stubGlobal("visualViewport", undefined);
  const cleanup = installVisualViewportSizing();
  expect(document.documentElement.style.getPropertyValue("--visible-width")).toBe("");
  expect(cleanup).not.toThrow();
});
