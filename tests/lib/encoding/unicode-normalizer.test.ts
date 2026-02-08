import { describe, expect, it } from "vitest";
import {
  detectConfusableCharacters,
  getNormalizationDiff,
  listCodePoints,
  normalizeUnicode,
} from "../../../lib/encoding/unicode-normalizer";

describe("unicode normalizer", () => {
  it("normalizes unicode forms", () => {
    const decomposed = "e\u0301";
    expect(normalizeUnicode(decomposed, "NFC")).toBe("é");
    expect(normalizeUnicode("é", "NFD")).toContain("\u0301");
  });

  it("can strip combining marks", () => {
    const stripped = normalizeUnicode("é", "NFD", true);
    expect(stripped).toBe("e");
  });

  it("lists code points", () => {
    const list = listCodePoints("Aé");
    expect(list).toHaveLength(2);
    expect(list[0].codePoint).toBe("U+0041");
  });

  it("detects confusables", () => {
    const matches = detectConfusableCharacters("pаypal");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].suggestedAscii).toBe("a");
  });

  it("finds first diff index", () => {
    const diff = getNormalizationDiff("e\u0301", "é");
    expect(diff.changed).toBe(true);
    expect(diff.firstDiffIndex).toBe(0);
  });
});
