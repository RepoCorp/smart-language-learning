import { describe, expect, it } from "vitest";

import { choicesForNextToken } from "../src/components/phraseBuilder/ProgressivePhraseBlocksReview";

describe("choicesForNextToken", () => {
  it("uses unrelated fallback words when no useful matching-initial distractors exist", () => {
    const choices = choicesForNextToken(
      [
        { id: "0-Heute", text: "Heute" },
        { id: "1-lerne", text: "lerne" },
        { id: "2-ich", text: "ich" },
        { id: "3-etwas", text: "etwas" },
      ],
      0,
      "german-progressive-blocks",
      [],
      "german",
    );

    expect(choices).toHaveLength(3);
    expect(choices.map((choice) => choice.text)).toContain("Heute");
    expect(new Set(choices.map((choice) => choice.text.toLowerCase())).size).toBe(3);
  });
});
