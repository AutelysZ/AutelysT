import { describe, it, expect } from "vitest";
import {
  encodeBase85,
  decodeBase85,
  isValidBase85,
} from "../../../lib/encoding/base85";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

describe("base85", () => {
  it("round-trips ascii85", () => {
    const input = "Hello Base85!";
    const encoded = encodeBase85(textEncoder.encode(input), "ascii85");
    const decoded = decodeBase85(encoded, "ascii85");
    expect(textDecoder.decode(decoded)).toBe(input);
  });

  it("round-trips raw ascii85 without framing", () => {
    const input = "Raw85";
    const encoded = encodeBase85(textEncoder.encode(input), "a85");
    expect(encoded.startsWith("<~")).toBe(false);
    expect(encoded.endsWith("~>")).toBe(false);
    const decoded = decodeBase85(encoded, "a85");
    expect(textDecoder.decode(decoded)).toBe(input);
  });

  it("round-trips z85 for 4-byte input", () => {
    const input = "test"; // 4 bytes
    const encoded = encodeBase85(textEncoder.encode(input), "z85");
    const decoded = decodeBase85(encoded, "z85");
    expect(textDecoder.decode(decoded)).toBe(input);
  });

  it("validates inputs", () => {
    const input = "Hello";
    const encoded = encodeBase85(textEncoder.encode(input), "a85");
    expect(isValidBase85(encoded, "a85")).toBe(true);
    expect(isValidBase85("$$$", "z85")).toBe(false);
  });
});
