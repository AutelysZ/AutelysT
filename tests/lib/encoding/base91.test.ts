import { describe, it, expect } from "vitest";
import {
  encodeBase91,
  decodeBase91,
  isValidBase91,
} from "../../../lib/encoding/base91";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

describe("base91", () => {
  it("round-trips base91", () => {
    const input = "Hello Base91!";
    const encoded = encodeBase91(textEncoder.encode(input));
    const decoded = decodeBase91(encoded);
    expect(textDecoder.decode(decoded)).toBe(input);
  });

  it("validates inputs", () => {
    const input = "Base91";
    const encoded = encodeBase91(textEncoder.encode(input));
    expect(isValidBase91(encoded)).toBe(true);
    expect(isValidBase91("€€€")).toBe(false);
  });
});
