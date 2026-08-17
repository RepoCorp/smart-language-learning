import { describe, expect, it } from "vitest";

import { buildWordPartUnits } from "../src/components/wordParts";

function chunksFor(word: string): string[] {
  return buildWordPartUnits(word).tokens.map((token) => token.text);
}

describe("buildWordPartUnits", () => {
  it("preserves the longest configured prefix and suffix", () => {
    expect(chunksFor("Zurücklichkeit")).toEqual(["Zurück", "lichkeit"]);
    expect(chunksFor("Verarbeitung")).toEqual(["Ver", "ar", "bei", "tung"]);
  });

  it("keeps configured vowel and consonant clusters intact", () => {
    expect(chunksFor("schreiben")).toEqual(["schr", "ei", "ben"]);
    expect(chunksFor("Schokolade")).toEqual(["Sch", "oko", "la", "de"]);
  });

  it("eliminates single-character chunks deterministically", () => {
    expect(chunksFor("hallo")).toEqual(["hal", "lo"]);
    expect(chunksFor("gehen")).toEqual(["ge", "hen"]);
  });

  it("keeps separators out of the draggable chunks", () => {
    const result = buildWordPartUnits("auf-stehen");
    expect(result.tokens.map((token) => token.text)).toEqual(["auf", "st", "ehen"]);
    expect(result.units.filter((unit) => unit.type === "separator")).toEqual([
      { type: "separator", text: "-" },
    ]);
  });
});
