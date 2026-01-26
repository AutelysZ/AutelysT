import { describe, it, expect } from "vitest";
import {
  convertCharset,
  decodeHexInput,
  decodeInputEncodingToBytes,
  detectBom,
  encodeHexOutput,
  getCharsetOptions,
  getDownloadPayload,
  stripBom,
} from "../../../lib/encoding/charset-converter";

describe("charset-converter", () => {
  it("returns UTF-8 first in charset options", () => {
    const options = getCharsetOptions();
    expect(options[0].value).toBe("UTF-8");
    expect(options.find((option) => option.value === "gbk")).toBeTruthy();
  });

  it("decodes plain hex input", () => {
    const bytes = decodeHexInput("48656c6c6f");
    expect(new TextDecoder().decode(bytes)).toBe("Hello");
  });

  it("decodes hex escape input", () => {
    const bytes = decodeHexInput("\\x48\\x65\\x6c\\x6c\\x6f");
    expect(new TextDecoder().decode(bytes)).toBe("Hello");
  });

  it("decodes URL hex input", () => {
    const bytes = decodeHexInput("%48%65%6c%6c%6f");
    expect(new TextDecoder().decode(bytes)).toBe("Hello");
  });

  it("decodes URL-safe base64 without padding", () => {
    const result = decodeInputEncodingToBytes("SGVsbG8", "base64");
    expect(new TextDecoder().decode(result.bytes)).toBe("Hello");
    expect(result.base64Detection?.hasPadding).toBe(false);
  });

  it("detects UTF-8 BOM", () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, 0x41]);
    const bom = detectBom(bytes);
    expect(bom?.charset).toBe("UTF-8");
    const stripped = stripBom(bytes);
    expect(stripped.bytes[0]).toBe(0x41);
  });

  it("encodes hex output formats", () => {
    const bytes = new Uint8Array([0x4f, 0x4b]);
    expect(encodeHexOutput(bytes, "hex", true)).toBe("4F4B");
    expect(encodeHexOutput(bytes, "hex-escape", false)).toBe("\\x4f\\x4b");
    expect(encodeHexOutput(bytes, "url", true)).toBe("%4F%4B");
  });

  it("converts text to base64 output", () => {
    const result = convertCharset({
      inputText: "Hello",
      inputEncoding: "raw",
      inputCharset: "UTF-8",
      outputCharset: "UTF-8",
      outputEncoding: "base64",
      outputBase64Padding: true,
      outputBase64UrlSafe: false,
      outputHexType: "hex",
      outputHexUpperCase: true,
      outputBom: false,
    });
    expect(result.outputText).toBe("SGVsbG8=");
  });

  it("builds download payload for raw output", () => {
    const payload = getDownloadPayload("Hello", new TextEncoder().encode("Hello"), "raw");
    expect(payload.mimeType).toBe("application/octet-stream");
  });
});
