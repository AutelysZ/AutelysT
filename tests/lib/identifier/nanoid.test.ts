import { describe, it, expect } from "vitest";
import {
  generateNanoIDs,
  DEFAULT_NANOID_ALPHABET,
} from "../../../lib/identifier/nanoid";

describe("nanoid", () => {
  it("generates the requested count and length", () => {
    const result = generateNanoIDs({
      count: 3,
      length: 10,
      alphabet: "abc",
    });

    expect(result.error).toBeUndefined();
    expect(result.ids).toHaveLength(3);
    result.ids.forEach((id) => {
      expect(id).toHaveLength(10);
      expect([...id].every((ch) => "abc".includes(ch))).toBe(true);
    });
  });

  it("defaults to the standard alphabet", () => {
    const result = generateNanoIDs({ count: 1, length: 5 });
    expect(result.error).toBeUndefined();
    expect(result.ids[0]).toHaveLength(5);
    expect(
      [...result.ids[0]].every((ch) => DEFAULT_NANOID_ALPHABET.includes(ch)),
    ).toBe(true);
  });

  it("rejects invalid alphabets", () => {
    const result = generateNanoIDs({
      count: 1,
      length: 8,
      alphabet: "aaaa",
    });
    expect(result.error).toBeDefined();
  });
});
