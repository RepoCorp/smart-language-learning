import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { I18nProvider } from "../src/i18n";
import { StudyTextSizeProvider } from "../src/accessibility/StudyTextSizeProvider";
import StudyTextSizeSetting from "../src/accessibility/StudyTextSizeSetting";
import ConfigurationPreferencesSection from "../src/features/configuration/components/ConfigurationPreferencesSection";

vi.mock("../src/api", () => ({ fetchOverviewStats: vi.fn().mockResolvedValue(null) }));

const mount = () => render(<I18nProvider><StudyTextSizeProvider><StudyTextSizeSetting /></StudyTextSizeProvider></I18nProvider>);
afterEach(() => { document.documentElement.style.removeProperty("--study-text-scale"); });

it("defaults to normal sizing and immediately applies and remembers a larger choice", async () => {
  const view = mount();
  const input = screen.getByRole("combobox", { name: "Tappable text size" });
  expect(input).toHaveValue("1");
  await userEvent.selectOptions(input, "1.5");
  expect(document.documentElement.style.getPropertyValue("--study-text-scale")).toBe("1.5");
  expect(localStorage.getItem("study_text_scale")).toBe("1.5");
  view.unmount();
  mount();
  expect(screen.getByRole("combobox", { name: "Tappable text size" })).toHaveValue("1.5");
});

it.each(["", "-1", "999", "broken"])("rejects an invalid stored size: %s", stored => {
  localStorage.setItem("study_text_scale", stored);
  mount();
  expect(screen.getByRole("combobox", { name: "Tappable text size" })).toHaveValue("1");
});

it("localizes the control and can return to the default size", async () => {
  localStorage.setItem("app_language", "es");
  localStorage.setItem("study_text_scale", "2");
  mount();
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "Tamaño del texto que puedes tocar" }), "1");
  expect(screen.getByRole("option", { name: "Normal" })).toBeInTheDocument();
  expect(document.documentElement.style.getPropertyValue("--study-text-scale")).toBe("1");
});

it("resets the study text size with the other configuration defaults", async () => {
  localStorage.setItem("study_text_scale", "2");
  render(<I18nProvider><StudyTextSizeProvider><ConfigurationPreferencesSection onStatsChange={() => {}} /></StudyTextSizeProvider></I18nProvider>);
  await userEvent.click(screen.getByRole("button", { name: /reset.*default/i }));
  expect(screen.getByRole("combobox", { name: "Tappable text size" })).toHaveValue("1");
  expect(localStorage.getItem("study_text_scale")).toBe("1");
});
