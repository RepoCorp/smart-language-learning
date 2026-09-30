import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { I18nProvider } from "../src/i18n";
import GuidedTour from "../src/guides/GuidedTour";
import { guidedTourCopy } from "../src/guides/guidedTourCopy";
import StudyTextSizeSetting from "../src/accessibility/StudyTextSizeSetting";
import { StudyTextSizeProvider } from "../src/accessibility/StudyTextSizeProvider";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it.each([
  ["en", false], ["en", true], ["es", false], ["es", true],
] as const)("guides text sizing in %s, allowing the current value (change: %s)", async (language, change) => {
  localStorage.setItem("app_language", language);
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
  const steps = guidedTourCopy(language).steps;
  const index = steps.findIndex(step => step.id === "study-text-size");
  expect(index).toBeGreaterThan(0);
  expect(steps[index - 1].id).toBe("target-language");
  expect(steps[index + 1].id).toBe("open-menu");
  const advance = vi.fn();
  const { container } = render(<I18nProvider><StudyTextSizeProvider>
    <MemoryRouter initialEntries={["/configurations"]}>
      <StudyTextSizeSetting />
      <GuidedTour open guideId="basics" stepIndex={index} onStepChange={advance} onFinish={vi.fn()} />
    </MemoryRouter>
  </StudyTextSizeProvider></I18nProvider>);
  const input = screen.getByRole("combobox");
  expect(input.closest('[data-guide-target="study-text-size"]')).not.toBeNull();
  await waitFor(() => expect(container.querySelector(".guided-tour-target")).not.toBeNull());
  expect(input).toHaveValue("1");
  if (change) {
    fireEvent.change(input, { target: { value: "1.5" } });
    expect(input).toHaveValue("1.5");
    expect(localStorage.getItem("study_text_scale")).toBe("1.5");
  }
  expect(advance).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: language === "es" ? "Siguiente" : "Next" }));
  expect(advance).toHaveBeenCalledWith(index + 1);
});
