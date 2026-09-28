import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../src/i18n";
import { StudyLanguagesProvider } from "../src/studyLanguages";
import WordFormationPatterns from "../src/components/strategies/WordFormationPatterns";
import PatternReview from "../src/components/session/PatternReview";
import { fetchWordFormationProgress, saveWordFormationPattern } from "../src/apiWordFormation";
import type { SessionItem } from "../src/types";

vi.mock("../src/apiWordFormation", () => ({
  fetchWordFormationProgress: vi.fn(), saveWordFormationPattern: vi.fn(),
}));

const patternEntry: SessionItem = {
  id: 8, item_type: "pattern", mode: "review", direction: "es_to_de", review_version: 0,
  german_text: "-less", spanish_text: "Patrón", options: [],
  pattern_exercise: { base: "hope", base_translation: "esperanza", meaning: "sin esperanza", question: "¿Cómo dirías «sin esperanza»?", answer: "hopeless", highlight: [4, 8] },
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchWordFormationProgress).mockResolvedValue({ supported: true, saved: [] });
  vi.mocked(saveWordFormationPattern).mockResolvedValue(undefined);
});

describe("pattern enrollment", () => {
  it("saves once and preserves saved state across words and reopening", async () => {
    const view = render(<WordFormationPatterns targetText="hopeless" targetLanguage="english" wordType="adjective" />);
    fireEvent.click(await screen.findByRole("button", { name: "Practise this pattern" }));
    await waitFor(() => expect(saveWordFormationPattern).toHaveBeenCalledWith("english_suffix_less", "spanish", "english"));
    expect(await screen.findByRole("button", { name: "In your learning deck" })).toBeDisabled();
    view.rerender(<WordFormationPatterns targetText="homeless" targetLanguage="english" wordType="adjective" />);
    expect(screen.getByRole("button", { name: "In your learning deck" })).toBeDisabled();
    view.unmount();
    vi.mocked(fetchWordFormationProgress).mockResolvedValue({ supported: true, saved: ["english_suffix_less"] });
    render(<WordFormationPatterns targetText="homeless" targetLanguage="english" wordType="adjective" />);
    expect(await screen.findByRole("button", { name: "In your learning deck" })).toBeDisabled();
  });

  it("shows failures without pretending it saved, then permits retry", async () => {
    vi.mocked(saveWordFormationPattern).mockRejectedValueOnce(new Error("offline"));
    render(<WordFormationPatterns targetText="hopeless" targetLanguage="english" wordType="adjective" />);
    fireEvent.click(await screen.findByRole("button", { name: "Practise this pattern" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not save");
    fireEvent.click(screen.getByRole("button", { name: "Practise this pattern" }));
    expect(await screen.findByRole("button", { name: "In your learning deck" })).toBeDisabled();
  });

  it("respects the study source language independently of the interface", async () => {
    localStorage.setItem("study_source_language", "english");
    localStorage.setItem("app_language", "es");
    render(<I18nProvider><StudyLanguagesProvider><WordFormationPatterns targetText="lesbar" targetLanguage="german" wordType="adjective" /></StudyLanguagesProvider></I18nProvider>);
    fireEvent.click(await screen.findByRole("button", { name: "Practicar este patrón" }));
    await waitFor(() => expect(saveWordFormationPattern).toHaveBeenCalledWith("german_suffix_bar", "english", "german"));
  });

  it("explicitly indicates unsupported source languages", async () => {
    vi.mocked(fetchWordFormationProgress).mockResolvedValue({ supported: false, saved: [] });
    render(<WordFormationPatterns targetText="lesbar" targetLanguage="german" wordType="adjective" />);
    expect(await screen.findByText(/not yet available for your learning languages/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Practise this pattern" })).not.toBeInTheDocument();
  });
});

describe("pattern review", () => {
  it("hides the answer until reveal, then rates without typing", async () => {
    const onReviewed = vi.fn();
    const onNext = vi.fn();
    const view = render(<PatternReview item={patternEntry} completed={false} disabled={false} onAnswered={onReviewed} onNext={onNext} />);
    expect(screen.getByText("hope")).toBeInTheDocument();
    expect(screen.getByText("esperanza")).toBeInTheDocument();
    expect(screen.getByText("¿Cómo dirías «sin esperanza»?")).toBeInTheDocument();
    expect(screen.queryByText(/hopeless/)).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Passed" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reveal answer" }));
    expect(view.container.querySelector("strong")).toHaveTextContent("less");
    fireEvent.click(screen.getByRole("button", { name: "Passed" }));
    await waitFor(() => expect(onReviewed).toHaveBeenCalledOnce());
    expect(onReviewed).toHaveBeenCalledWith(true);
    view.rerender(<PatternReview item={patternEntry} completed disabled={false} onAnswered={onReviewed} onNext={onNext} />);
    expect(screen.queryByRole("button", { name: "Passed" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onNext).toHaveBeenCalledOnce();
  });

  it("keeps the revealed answer and rating controls on save failure", async () => {
    const onReviewed = vi.fn().mockRejectedValueOnce(new Error("offline"));
    render(<PatternReview item={patternEntry} completed={false} disabled={false} onAnswered={onReviewed} onNext={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Reveal answer" }));
    fireEvent.click(screen.getByRole("button", { name: "Failed" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(onReviewed).toHaveBeenCalledWith(false);
    expect(screen.getByRole("button", { name: "Failed" })).toBeEnabled();
  });

  it("asks for recognition with the base meaning, hiding the derived meaning until reveal", () => {
    const item: SessionItem = { ...patternEntry, direction: "de_to_es", pattern_exercise: {
      ...patternEntry.pattern_exercise!, question: "¿Qué significa «hopeless»?",
    } };
    render(<PatternReview item={item} completed={false} disabled={false} onAnswered={vi.fn()} onNext={vi.fn()} />);
    expect(screen.getByText("¿Qué significa «hopeless»?")).toBeInTheDocument();
    expect(screen.getByText("esperanza")).toBeInTheDocument();
    expect(screen.queryByText("sin esperanza")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reveal answer" }));
    expect(screen.getByText("sin esperanza")).toBeInTheDocument();
  });
});
