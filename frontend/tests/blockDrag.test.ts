import { afterEach, describe, expect, it, vi } from "vitest";
import { blockDragStart, isPointerOverBlockTarget } from "../src/components/phraseBuilder/blockDrag";

const rect = { left: 100, top: 100, right: 180, bottom: 140, width: 80, height: 40 } as DOMRect;
afterEach(() => vi.unstubAllGlobals());

describe("shared block drag positioning", () => {
  it("lifts touch blocks immediately, independently of screen size", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    expect(blockDragStart(rect, 140, 120, "touch")).toEqual({
      offset: { x: 40, y: 63 }, position: { left: 100, top: 57 }, isTouch: true,
    });
  });

  it("keeps the desktop pickup stable and the moving block above the cursor", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    expect(blockDragStart(rect, 140, 120, "mouse")).toEqual({
      offset: { x: 40, y: 35 }, position: { left: 100, top: 100 }, isTouch: false,
    });
  });

  it("uses the same generous finger target across exercises", () => {
    expect(isPointerOverBlockTarget(rect, 140, 160, true)).toBe(true);
    expect(isPointerOverBlockTarget(rect, 140, 160, false)).toBe(false);
    expect(isPointerOverBlockTarget(rect, 140, 180, true)).toBe(false);
  });
});
