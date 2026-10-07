import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import ItemViewHeader from "../../src/components/itemView/legacy/LegacyItemViewHeader";

const props = {
  itemType: "word" as const,
  targetText: "der Hund",
  sourceText: "el perro",
  wordType: "noun",
  notes: "A familiar animal.",
  audioUrl: "/dog.mp3",
  targetLanguage: "german" as const,
  wordTypeLabel: "Word type",
  unknownWordTypeLabel: "Unknown",
  notesLabel: "Notes",
  noAudioSupportLabel: "Audio unavailable",
};

it("preserves the noun title, gender hint, translation, metadata and audio", () => {
  const { container } = render(<ItemViewHeader {...props} />);
  const heading = screen.getByRole("heading", { name: "der Hund" });
  expect(heading).toHaveClass("item-view-title");
  expect(heading.querySelector(".gender-word-masculine")).not.toBeNull();
  expect(screen.getByText("el perro")).toHaveClass("item-view-subtitle");
  expect(screen.getByText("noun")).toBeInTheDocument();
  expect(screen.getByText("A familiar animal.")).toBeInTheDocument();
  expect(container.querySelector("audio")).toHaveAttribute("src", "/dog.mp3");
  expect(container.querySelector("audio")).toHaveAttribute("controls");
});

it("keeps phrases free of word metadata and omits absent audio", () => {
  const { container } = render(<ItemViewHeader {...props} itemType="phrase" targetText="Ich komme." audioUrl="" />);
  expect(screen.getByRole("heading", { name: "Ich komme." })).toBeInTheDocument();
  expect(screen.queryByText("Word type")).not.toBeInTheDocument();
  expect(screen.getByText("Notes")).toBeInTheDocument();
  expect(container.querySelector("audio")).toBeNull();
});

it("preserves empty word-type and notes labels", () => {
  render(<ItemViewHeader {...props} wordType="" notes="" />);
  expect(screen.getByText("Unknown")).toBeInTheDocument();
  expect(screen.getByText("-")).toBeInTheDocument();
});

it("keeps the original title behavior when only a translation exists", () => {
  render(<ItemViewHeader {...props} targetText="" />);
  expect(screen.getByRole("heading", { name: "el perro" })).toBeInTheDocument();
});

it.each([
  ["german", "der Hund", "masculine"],
  ["german", "die Katze", "feminine"],
  ["german", "das Haus", "neuter"],
  ["spanish", "el perro", "masculine"],
  ["spanish", "la casa", "feminine"],
  ["spanish", "los perros", "masculine"],
  ["spanish", "las casas", "feminine"],
  ["german", "  DER   Hund  ", "masculine"],
] as const)("preserves the %s noun title and gender for %s", (language, text, gender) => {
  render(<ItemViewHeader {...props} targetLanguage={language} targetText={text} wordType=" NOUN " />);
  const heading = screen.getByRole("heading", { name: text.trim().replace(/\s+/g, " ") });
  expect(heading.querySelector(`.gender-word-${gender}`)).toHaveTextContent(text.trim().replace(/\s+/g, " "));
});

it.each([
  ["german", "el perro", "word", "noun"],
  ["spanish", "der Hund", "word", "noun"],
  ["english", "the dog", "word", "noun"],
  ["german", "Hund", "word", "noun"],
  ["german", "der", "word", "noun"],
  ["german", "der Hund", "phrase", "noun"],
  ["german", "der Hund", "word", "expression"],
] as const)("keeps %s %s uncolored for %s/%s", (language, text, itemType, wordType) => {
  render(<ItemViewHeader {...props} targetLanguage={language} targetText={text} itemType={itemType} wordType={wordType} />);
  expect(screen.getByRole("heading", { name: text }).querySelector(".gender-word-mark")).toBeNull();
});
