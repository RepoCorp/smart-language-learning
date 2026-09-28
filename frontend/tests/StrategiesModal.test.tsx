import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../src/i18n";
import StrategiesModal from "../src/components/strategies/StrategiesModal";
import { PHRASE_STRATEGIES, WORD_STRATEGIES } from "../src/components/strategies/strategyConstants";

function Modal({ itemType }: { itemType: "word" | "phrase" }) {
  const [strategy, setStrategy] = useState("Forms");
  return <StrategiesModal itemType={itemType} sourceText="Hello" targetText="Hallo"
    targetLanguage="german" wordType="" selectedStrategy={strategy}
    onSelectedStrategyChange={setStrategy} onClose={vi.fn()} strategyContent={<p>{strategy} content</p>} />;
}

describe.each(["en", "es"] as const)("%s strategy selector", language => {
  it.each(["word", "phrase"] as const)("keeps an accessible native dropdown for %s strategies", async itemType => {
    localStorage.setItem("app_language", language);
    render(<I18nProvider><Modal itemType={itemType} /></I18nProvider>);
    const selector = screen.getByRole("combobox", { name: language === "en" ? "Strategies" : "Estrategias" });
    expect(selector.tagName).toBe("SELECT");
    expect(selector.closest(".strategy-picker")).not.toBeNull();
    expect(screen.getAllByRole("option")).toHaveLength(itemType === "word" ? WORD_STRATEGIES.length : PHRASE_STRATEGIES.length);
    await userEvent.selectOptions(selector, "Grammar");
    expect(selector).toHaveValue("Grammar");
    expect(screen.getByText("Grammar content")).toBeInTheDocument();
  });
});
