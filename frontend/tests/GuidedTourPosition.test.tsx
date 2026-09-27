import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GuidedTour from "../src/guides/GuidedTour";
import { guidedTourCopy } from "../src/guides/guidedTourCopy";

let buttonTop = 600;
let cardHeight = 260;
const stepIndex = guidedTourCopy("en").steps.findIndex(step => step.id === "create-dialog");

beforeEach(() => {
  buttonTop = 600;
  cardHeight = 260;
  vi.stubGlobal("innerWidth", 1280);
  vi.stubGlobal("innerHeight", 800);
  vi.stubGlobal("MutationObserver", class { observe() {} disconnect() {} });
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const isCard = this.classList.contains("guided-tour-popover");
    const top = isCard ? 0 : buttonTop;
    const height = isCard ? cardHeight : 40;
    return { x: 100, y: top, top, bottom: top + height, left: 100, right: 420, width: 320, height, toJSON() {} };
  });
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
});

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function setup() {
  const generate = vi.fn();
  const advance = vi.fn();
  const { container } = render(<MemoryRouter initialEntries={["/content/create"]}>
    <button data-guide-target="generate-dialog" onClick={generate}>Generate preview</button>
    <GuidedTour open guideId="basics" stepIndex={stepIndex} onStepChange={advance} onFinish={vi.fn()} />
  </MemoryRouter>);
  return { container, generate, advance, card: container.querySelector<HTMLElement>(".guided-tour-popover")! };
}

describe("Create dialog guide positioning on desktop", () => {
  it("places the card above a low button without covering it", async () => {
    const { card, generate, advance } = setup();
    await waitFor(() => expect(card).toHaveStyle({ top: "326px" }));
    expect(parseFloat(card.style.top) + cardHeight).toBeLessThan(buttonTop);
    fireEvent.click(screen.getByRole("button", { name: "Generate preview" }));
    expect(generate).toHaveBeenCalledOnce();
    expect(advance).not.toHaveBeenCalled();
  });

  it("keeps the card below the button when it fits", async () => {
    buttonTop = 100;
    const { card } = setup();
    await waitFor(() => expect(card).toHaveStyle({ top: "154px" }));
  });

  it("uses the actual height of a taller card", async () => {
    cardHeight = 400;
    const { card } = setup();
    await waitFor(() => expect(card).toHaveStyle({ top: "186px" }));
  });

  it("extends the scroll area when the card fits on neither side", async () => {
    vi.stubGlobal("innerHeight", 300);
    buttonTop = 150;
    cardHeight = 400;
    const { card, container } = setup();
    await waitFor(() => expect(card).toHaveStyle({ top: "204px" }));
    expect(container.querySelector(".guided-tour-scroll-content")).toHaveStyle({ minHeight: "620px" });
  });
});
