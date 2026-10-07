import { expect, it } from "vitest";
import { isLearningDefinition } from "../../src/features/learningContent/definition";
import { keit, phrase, word } from "./fixtures";

it.each([keit, word, phrase])("accepts the registered $item_view family without interpreting its extra fields", definition => {
  expect(isLearningDefinition(definition)).toBe(true);
});

it("allows empty text and activity collections", () => {
  expect(isLearningDefinition({
    key: "", language: "", item_view: "", display: {}, strategies: [], exercises: [], evaluations: {},
  })).toBe(true);
  expect(isLearningDefinition({
    ...word, display: { en: { title: "", explanation: "" } }, strategies: [""], exercises: [""],
  })).toBe(true);
});

it("allows missing display languages and additional language and evaluation keys", () => {
  expect(isLearningDefinition({
    ...word,
    display: { en: undefined, fr: { title: "Example", explanation: "" } },
    evaluations: { another_direction: "" },
  })).toBe(true);
});

it.each([null, undefined, false, "definition", 1, [], {}])("rejects a missing or incomplete definition: %j", value => {
  expect(isLearningDefinition(value)).toBe(false);
});

it.each([
  { key: undefined }, { language: 42 }, { item_view: null },
  { display: undefined }, { display: [] }, { display: { en: null } },
  { display: { en: { title: "Example" } } },
  { display: { en: { title: 1, explanation: "" } } },
  { display: { en: { title: "Example", explanation: null } } },
  { strategies: "examples" }, { strategies: [1] },
  { exercises: undefined }, { exercises: [null] },
  { evaluations: undefined }, { evaluations: [] },
  { evaluations: { source_to_target: undefined } }, { evaluations: { source_to_target: 1 } },
])("rejects invalid base fields: %j", invalid => {
  expect(isLearningDefinition({ ...word, ...invalid })).toBe(false);
});
