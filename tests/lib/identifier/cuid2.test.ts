import { describe, expect, it } from "vitest";
import {
  generateCuid2Batch,
  getCuid2Defaults,
  isValidCuid2,
  parseCuid2Lines,
} from "../../../lib/identifier/cuid2";

describe("cuid2", () => {
  it("generates requested count", () => {
    const { defaultLength } = getCuid2Defaults();
    const result = generateCuid2Batch({ count: 3 });
    expect(result.error).toBeUndefined();
    expect(result.ids).toHaveLength(3);
    for (const id of result.ids) {
      expect(isValidCuid2(id)).toBe(true);
      expect(id.length).toBe(defaultLength);
    }
  });

  it("supports custom length", () => {
    const result = generateCuid2Batch({ count: 2, length: 12 });
    expect(result.error).toBeUndefined();
    expect(result.ids.every((id) => id.length === 12)).toBe(true);
  });

  it("rejects invalid count", () => {
    const result = generateCuid2Batch({ count: 0 });
    expect(result.error).toBeDefined();
  });

  it("parses lines", () => {
    const generated = generateCuid2Batch({ count: 2 });
    const lines = generated.ids.join("\n");
    const parsed = parseCuid2Lines(lines);
    expect(parsed).toHaveLength(2);
    expect(parsed.every((item) => item.valid)).toBe(true);
  });
});
