import { describe, it, expect } from "vitest";
import {
  decodeBencode,
  decodeInputData,
  encodeBencode,
  encodeOutputData,
  validateJsonForBencode,
} from "../../../lib/bencode/codec";

describe("bencode codec", () => {
  it("encodes and decodes JSON values", () => {
    const input = { foo: "bar", count: 3, list: ["a", "b"] };
    const encoded = encodeBencode(input);
    const decoded = decodeBencode(encoded);
    expect(decoded).toEqual(input);
  });

  it("preserves non-UTF8 bytes as binary", () => {
    const bytes = new Uint8Array([0xff, 0xff]);
    const encoded = encodeBencode(bytes);
    const decoded = decodeBencode(encoded);
    expect(decoded instanceof Uint8Array).toBe(true);
  });

  it("decodes base64 and hex input", () => {
    const base64Bytes = decodeInputData("SGVsbG8=", "base64");
    const hexBytes = decodeInputData("48656c6c6f", "hex");
    expect(new TextDecoder().decode(base64Bytes)).toBe("Hello");
    expect(new TextDecoder().decode(hexBytes)).toBe("Hello");
  });

  it("encodes output as base64url", () => {
    const bytes = new Uint8Array([0xfb, 0xef]);
    const output = encodeOutputData(bytes, "base64url");
    expect(output.text).toBe("--8");
  });

  it("validates JSON input", () => {
    const invalid = validateJsonForBencode("{oops}");
    expect(invalid.isValid).toBe(false);
  });
});
