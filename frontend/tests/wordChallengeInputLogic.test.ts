import { describe, expect, it } from "vitest";
import {
  hintOptionLabel, nextLetterSuggestions, normalizeWordAnswer, resolveWordInputChange,
} from "../src/components/wordChallengeInputLogic";

describe("word input decisions", () => {
  it.each(["", "H", "Ha", "Haus"])("accepts a correct prefix or deletion: %j", (value) => {
    expect(resolveWordInputChange({ value, acceptedAnswer: "Hau", expectedAnswer: "Haus", provisionalBaseAnswer: null }))
      .toEqual({ kind: "accept", nextAnswer: value });
  });

  it("waits for mobile capitalization rather than counting it as a confirmed mistake", () => {
    expect(resolveWordInputChange({ value: "h", acceptedAnswer: "", expectedAnswer: "Haus", provisionalBaseAnswer: null }))
      .toEqual({ kind: "hide_pending_case_mismatch", pendingCaseMismatch: {
        acceptedAnswer: "", typedLetter: "h", expectedLetter: "H", mismatchIndex: 0,
      } });
  });

  it.each(["ü", "é", "ñ"])("accepts the unfinished base of %s, then its accent", (letter) => {
    const base = letter.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const expectedAnswer = `a${letter}z`;
    expect(resolveWordInputChange({ value: `a${base}`, acceptedAnswer: "a", expectedAnswer, provisionalBaseAnswer: null }))
      .toEqual({ kind: "accept_provisional", nextAnswer: `a${base}`, provisionalBaseAnswer: "a" });
    expect(resolveWordInputChange({ value: `a${letter}`, acceptedAnswer: `a${base}`, expectedAnswer, provisionalBaseAnswer: "a" }))
      .toEqual({ kind: "accept", nextAnswer: `a${letter}` });
  });

  it("rolls back to the prefix before an unfinished accent on a confirmed mistake", () => {
    expect(resolveWordInputChange({ value: "cafex", acceptedAnswer: "cafe", expectedAnswer: "café", provisionalBaseAnswer: "caf" }))
      .toEqual({ kind: "reject", fallbackAnswer: "caf", mismatchIndex: 3, wrongText: "x" });
  });

  it("does not use stale provisional text from a different prefix", () => {
    expect(resolveWordInputChange({ value: "Hax", acceptedAnswer: "Ha", expectedAnswer: "Haus", provisionalBaseAnswer: "caf" }))
      .toEqual({ kind: "reject", fallbackAnswer: "Ha", mismatchIndex: 2, wrongText: "x" });
  });

  it.each([
    ["Haut", "Hau", 3], ["Hausx", "Haus", 4], ["Xaus", "Hau", 0], ["haus", "", 0],
  ])("rejects incorrect input %s without discarding the accepted prefix", (value, acceptedAnswer, mismatchIndex) => {
    expect(resolveWordInputChange({ value: String(value), acceptedAnswer: String(acceptedAnswer), expectedAnswer: "Haus", provisionalBaseAnswer: null }))
      .toMatchObject({ kind: "reject", fallbackAnswer: acceptedAnswer, mismatchIndex });
  });

  it("keeps accents, case, and internal spaces significant in final comparisons", () => {
    expect(normalizeWordAnswer("  café  ")).toBe("café");
    expect(normalizeWordAnswer("cafe")).not.toBe(normalizeWordAnswer("café"));
    expect(normalizeWordAnswer("Haus")).not.toBe(normalizeWordAnswer("haus"));
    expect(normalizeWordAnswer("a  b")).not.toBe(normalizeWordAnswer("a b"));
  });
});

describe("next-letter hints", () => {
  it.each([0, 1, 2, 19, 20, 83])("gives repeatable, distinct options with matching case at position %i", (offset) => {
    const options = nextLetterSuggestions("H", offset);
    expect(options).toEqual(nextLetterSuggestions("H", offset));
    expect(options).toHaveLength(3);
    expect(new Set(options).size).toBe(3);
    expect(options).toContain("H");
    expect(options.every(letter => letter === letter.toUpperCase())).toBe(true);
  });

  it.each([" ", ".", "-", "1"])("shows only the expected fixed character %j", (character) => {
    expect(nextLetterSuggestions(character, 0)).toEqual([character]);
  });

  it("has no hints beyond the end and labels invisible characters", () => {
    expect(nextLetterSuggestions("", 10)).toEqual([]);
    expect(hintOptionLabel(" ")).toBe("␠");
    expect(hintOptionLabel("\t")).toBe("⇥");
    expect(hintOptionLabel("ü")).toBe("ü");
  });
});
