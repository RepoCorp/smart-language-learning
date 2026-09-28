import { useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import ContentCreateFormCard from "../src/features/content/create/components/ContentCreateFormCard";
import { guidedTourCopy } from "../src/guides/guidedTourCopy";
import { GUIDED_TOUR_ACTION_EVENT, requestGuidedTourSection } from "../src/guides/guidedTourEvents";
import GuidedTour from "../src/guides/GuidedTour";

const CREATE_NEW = "__create_new__";
const RANDOM = "__random_topic__";

function TopicForm() {
  const [selectedTopic, setSelectedTopic] = useState(RANDOM);
  const [customTopic, setCustomTopic] = useState("");
  const [level, setLevel] = useState<"A0" | "A1" | "A2" | "B1" | "B2">("A2");
  return <ContentCreateFormCard
    selectedTopic={selectedTopic} customTopic={customTopic}
    selectedContext="" customContext="" conversationDetails="" requiredWords=""
    requiredWordsLanguage="target" dialogLength="standard" proficiencyLevel={level}
    previousTopics={["At the supermarket", "Travelling"]} previousContexts={[]}
    loading={false} saving={false}
    resolvedTopic={selectedTopic === CREATE_NEW ? customTopic : selectedTopic}
    onSelectedTopicChange={setSelectedTopic} onCustomTopicChange={setCustomTopic}
    onSelectedContextChange={() => {}} onCustomContextChange={() => {}}
    onConversationDetailsChange={() => {}} onRequiredWordsChange={() => {}}
    onRequiredWordsLanguageChange={() => {}} onDialogLengthChange={() => {}}
    onProficiencyLevelChange={setLevel} onGeneratePreview={() => {}}
  />;
}

const listeners: EventListener[] = [];
afterEach(() => {
  listeners.forEach(listener => window.removeEventListener(GUIDED_TOUR_ACTION_EVENT, listener));
  listeners.length = 0;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("starter guide dialog level step", () => {
  it.each(["en", "es"] as const)("places the %s level step between topic and generation", language => {
    const steps = guidedTourCopy(language).steps;
    const index = steps.findIndex(step => step.id === "dialog-level");
    expect(index).toBeGreaterThan(0);
    expect(steps[index - 1].id).toBe("personal-topic");
    expect(steps[index + 1].id).toBe("create-dialog");
    expect(steps[index]).toMatchObject({ target: "dialog-level", openSection: "options", route: "/content/create" });
    expect(steps[index].hideNext).not.toBe(true);
    expect(steps[index].body).toContain("A1");
    expect(steps[index].body).toContain("B2");
    expect(steps[index].body).toContain(language === "en" ? "Absolute beginner" : "Principiante absoluto");
  });

  it.each([false, true])("opens and highlights levels, then allows continuing (change level: %s)", async changeLevel => {
    const index = guidedTourCopy("en").steps.findIndex(step => step.id === "dialog-level");
    expect(index).toBeGreaterThan(0);
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
    const advance = vi.fn();
    render(<MemoryRouter initialEntries={["/content/create"]}>
      <TopicForm />
      <GuidedTour open guideId="basics" stepIndex={index} onStepChange={advance} onFinish={vi.fn()} />
    </MemoryRouter>);
    const selected = await screen.findByRole("radio", { name: "A2" });
    expect(selected).toBeChecked();
    expect(selected.closest('[data-guide-target="dialog-level"]')).not.toBeNull();
    expect(screen.queryByRole("combobox", { name: "Topic" })).not.toBeInTheDocument();
    if (changeLevel) {
      fireEvent.click(screen.getByRole("radio", { name: "B1" }));
      expect(screen.getByRole("radio", { name: "B1" })).toBeChecked();
    }
    expect(advance).not.toHaveBeenCalled();
    const next = screen.getByRole("button", { name: "Next" });
    await waitFor(() => expect(next).toBeEnabled());
    fireEvent.click(next);
    expect(advance).toHaveBeenCalledWith(index + 1);
  });
});

it("allows selecting the absolute beginner dialog level", () => {
  render(<TopicForm />);
  act(() => requestGuidedTourSection("options"));
  fireEvent.click(screen.getByRole("radio", { name: "Absolute beginner" }));
  expect(screen.getByRole("radio", { name: "Absolute beginner" })).toBeChecked();
});

function setup(language: "en" | "es") {
  const step = guidedTourCopy(language).steps.find(step => step.id === "personal-topic")!;
  const advance = vi.fn();
  const listener: EventListener = event => {
    if ((event as CustomEvent<{ action: string }>).detail.action === step.advanceOnAction) advance();
  };
  window.addEventListener(GUIDED_TOUR_ACTION_EVENT, listener);
  listeners.push(listener);
  render(<TopicForm />);
  act(() => requestGuidedTourSection(step.openSection!));
  return { advance, select: screen.getByRole("combobox", { name: "Topic" }), step };
}

describe.each(["en", "es"] as const)("%s starter guide topic step", language => {
  it("advances when an existing topic is selected", () => {
    const { advance, select, step } = setup(language);
    expect(step.hideNext).toBe(true);
    expect(advance).not.toHaveBeenCalled();
    fireEvent.change(select, { target: { value: "At the supermarket" } });
    expect(advance).toHaveBeenCalledTimes(1);
  });

  it("still requires a nonempty new topic confirmed with Enter", () => {
    const { advance, select } = setup(language);
    fireEvent.change(select, { target: { value: CREATE_NEW } });
    const input = document.querySelector<HTMLInputElement>("#topic-input")!;
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(advance).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "Buying groceries" } });
    expect(advance).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(advance).toHaveBeenCalledTimes(1);
  });

  it("does not advance for the default random topic or an unfinished new topic", () => {
    const { advance, select } = setup(language);
    expect(select).toHaveValue(RANDOM);
    fireEvent.change(select, { target: { value: CREATE_NEW } });
    fireEvent.change(select, { target: { value: RANDOM } });
    expect(advance).not.toHaveBeenCalled();
  });
});
