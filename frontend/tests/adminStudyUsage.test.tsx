import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { fetchAdminAIUsage } from "../src/adminUsageApi";
import ConfigurationAdminAIUsageSection from "../src/features/admin/components/ConfigurationAdminAIUsageSection";
import { I18nProvider } from "../src/i18n";

vi.mock("../src/adminUsageApi", () => ({ fetchAdminAIUsage: vi.fn(), updateAdminAIUsageLimit: vi.fn() }));
vi.mock("../src/authApi", () => ({ deleteUserAccount: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
});

it.each([
  ["en", 37, "37 session study minutes", "2 live minutes"],
  ["es", 37, "37 minutos de estudio en sesiones", "2 minutos de conversación en vivo"],
  ["en", 0, "0 session study minutes", "2 live minutes"],
] as const)("shows recorded study time in the collapsed %s summary (%s min)", async (language, minutes, study, live) => {
  localStorage.setItem("app_language", language);
  const limits = { weekly_generation_credits: 200, weekly_elevenlabs_characters: 10000, weekly_elevenlabs_music_seconds: 60, weekly_realtime_minutes: 45 };
  vi.mocked(fetchAdminAIUsage).mockResolvedValue({
    week_start: "2026-09-21", defaults: limits,
    users: [{
      id: 1, username: "learner", email: "learner@example.com", is_superuser: false, is_blocked: false,
      ...limits, week_generation_credits: 12, week_elevenlabs_characters: 500,
      week_elevenlabs_music_seconds: 8, week_realtime_minutes: 2, week_study_minutes: minutes,
    }],
  });

  render(<I18nProvider><ConfigurationAdminAIUsageSection canManage /></I18nProvider>);

  const account = await screen.findByText("learner");
  const summary = account.closest("summary");
  expect(summary).toHaveTextContent(study);
  expect(summary).toHaveTextContent(live);
  expect(account.closest("details")).not.toHaveAttribute("open");
});

it("does not fetch or display consumption for non-admins", () => {
  const { container } = render(<I18nProvider><ConfigurationAdminAIUsageSection canManage={false} /></I18nProvider>);
  expect(container).toBeEmptyDOMElement();
  expect(fetchAdminAIUsage).not.toHaveBeenCalled();
});
