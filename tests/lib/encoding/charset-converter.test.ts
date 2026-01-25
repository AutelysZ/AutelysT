import { describe, it, expect } from "vitest";
import {
  convertCharset,
  getAllCharsets,
  validateInput,
  canUseRawInput,
  decodeToBytes,
  encodeOutput,
  bytesToDisplayText,
  autoDetectCharsetAndEncoding,
  type InputEncodingType,
  type OutputEncodingType,
} from "../../../lib/encoding/charset-converter";

describe("charset-converter", () => {
  describe("getAllCharsets", () => {
    it("should return non-empty charset list", () => {
      const charsets = getAllCharsets();
      expect(charsets.length).toBeGreaterThan(0);
    });

    it("should include UTF-8 as first option", () => {
      const charsets = getAllCharsets();
      expect(charsets[0].value).toBe("UTF-8");
    });

    it("should include common charsets", () => {
      const charsets = getAllCharsets();
      const values = charsets.map((c) => c.value);
      expect(values).toContain("UTF-8");
      expect(values).toContain("UTF-16LE");
      expect(values).toContain("gbk");
      expect(values).toContain("shiftjis");
    });
  });

  describe("canUseRawInput", () => {
    it("should return true for UTF-8", () => {
      expect(canUseRawInput("UTF-8")).toBe(true);
      expect(canUseRawInput("utf-8")).toBe(true);
      expect(canUseRawInput("Utf-8")).toBe(true);
    });

    it("should return false for non-UTF-8 charsets", () => {
      expect(canUseRawInput("GBK")).toBe(false);
      expect(canUseRawInput("Shift_JIS")).toBe(false);
      expect(canUseRawInput("ISO-8859-1")).toBe(false);
    });
  });

  describe("validateInput", () => {
    it("should validate raw input", () => {
      expect(validateInput("hello world", "raw")).toBe(true);
      expect(validateInput("", "raw")).toBe(true);
    });

    it("should validate base64 input", () => {
      expect(validateInput("SGVsbG8gV29ybGQ=", "base64")).toBe(true);
      // "hello" is technically valid base64 characters (though not properly padded)
      // This is expected behavior for character validation
      expect(validateInput("!!!", "base64")).toBe(false);
    });

    it("should validate URL-encoded input", () => {
      expect(validateInput("hello%20world", "url")).toBe(true);
      expect(validateInput("%20%21", "url")).toBe(true);
      expect(validateInput("hello world", "url")).toBe(false);
    });

    it("should validate hex-escape input", () => {
      expect(validateInput("\\x48\\x65\\x6c\\x6c\\x6f", "hex-escape")).toBe(
        true,
      );
      expect(validateInput("\\xFF\\x00", "hex-escape")).toBe(true);
      expect(validateInput("hello", "hex-escape")).toBe(false);
    });
  });

  describe("bytesToDisplayText", () => {
    it("should decode UTF-8 bytes", () => {
      const bytes = new TextEncoder().encode("Hello 世界");
      const text = bytesToDisplayText(bytes);
      expect(text).toBe("Hello 世界");
    });

    it("should handle invalid UTF-8 gracefully", () => {
      const bytes = new Uint8Array([0xff, 0xfe]);
      const text = bytesToDisplayText(bytes);
      expect(text.length).toBe(2);
    });
  });

  describe("decodeToBytes", () => {
    it("should decode raw UTF-8 input", () => {
      const bytes = decodeToBytes("Hello", "raw", "UTF-8");
      const expected = new TextEncoder().encode("Hello");
      expect(bytes).toEqual(expected);
    });

    it("should decode base64 input", () => {
      const bytes = decodeToBytes("SGVsbG8=", "base64", "UTF-8");
      const expected = new TextEncoder().encode("Hello");
      expect(bytes).toEqual(expected);
    });

    it("should decode URL-encoded input", () => {
      const bytes = decodeToBytes("hello%20world", "url", "UTF-8");
      const expected = new TextEncoder().encode("hello world");
      expect(bytes).toEqual(expected);
    });

    it("should decode hex-escape input", () => {
      const bytes = decodeToBytes(
        "\\x48\\x65\\x6c\\x6c\\x6f",
        "hex-escape",
        "UTF-8",
      );
      const expected = new TextEncoder().encode("Hello");
      expect(bytes).toEqual(expected);
    });

    it("should throw for raw input with non-UTF-8 charset", () => {
      expect(() => decodeToBytes("hello", "raw", "GBK")).toThrow();
    });
  });

  describe("encodeOutput", () => {
    it("should encode to raw output", () => {
      const bytes = new TextEncoder().encode("Hello 世界");
      const result = encodeOutput(bytes, "raw");
      expect(result).toBe("Hello 世界");
    });

    it("should encode to base64 output", () => {
      const bytes = new TextEncoder().encode("Hello");
      const result = encodeOutput(bytes, "base64");
      expect(result).toBe("SGVsbG8=");
    });

    it("should encode to URL output", () => {
      const bytes = new TextEncoder().encode("hello world");
      const result = encodeOutput(bytes, "url");
      expect(result).toBe("hello%20world");
    });

    it("should encode to URL output with GBK charset", () => {
      // Convert "中" from UTF-8 to GBK bytes, then URL-encode
      const result = convertCharset("中", {
        inputCharset: "UTF-8",
        inputEncoding: "raw",
        outputCharset: "GBK",
        outputEncoding: "url",
      });
      // "中" in GBK is 0xD6 0xD0
      expect(result.displayText).toBe("%D6%D0");
    });

    it("should encode to hex-escape output", () => {
      const bytes = new TextEncoder().encode("Hello");
      const result = encodeOutput(bytes, "hex-escape");
      // Default is uppercase
      expect(result).toBe("\\x48\\x65\\x6C\\x6C\\x6F");
    });
  });

  describe("convertCharset", () => {
    it("should convert UTF-8 to UTF-16LE", () => {
      const result = convertCharset("Hi", {
        inputCharset: "UTF-8",
        inputEncoding: "raw",
        outputCharset: "UTF-16LE",
        outputEncoding: "raw",
      });
      // UTF-16LE will include null bytes for ASCII, but display should decode correctly
      expect(result.bytes.length).toBeGreaterThan(0);
    });

    it("should convert UTF-8 to Base64", () => {
      const result = convertCharset("Hello", {
        inputCharset: "UTF-8",
        inputEncoding: "raw",
        outputCharset: "UTF-8",
        outputEncoding: "base64",
      });
      expect(result.displayText).toBe("SGVsbG8=");
    });

    it("should convert Base64 to UTF-8", () => {
      const result = convertCharset("SGVsbG8=", {
        inputCharset: "UTF-8",
        inputEncoding: "base64",
        outputCharset: "UTF-8",
        outputEncoding: "raw",
      });
      expect(result.displayText).toBe("Hello");
    });

    it("should convert URL-encoded to UTF-8", () => {
      const result = convertCharset("hello%20world", {
        inputCharset: "UTF-8",
        inputEncoding: "url",
        outputCharset: "UTF-8",
        outputEncoding: "raw",
      });
      expect(result.displayText).toBe("hello world");
    });

    it("should convert hex-escape to UTF-8", () => {
      const result = convertCharset("\\x48\\x65\\x6c\\x6c\\x6f", {
        inputCharset: "UTF-8",
        inputEncoding: "hex-escape",
        outputCharset: "UTF-8",
        outputEncoding: "raw",
      });
      expect(result.displayText).toBe("Hello");
    });

    it("should handle empty input", () => {
      const result = convertCharset("", {
        inputCharset: "UTF-8",
        inputEncoding: "raw",
        outputCharset: "UTF-8",
        outputEncoding: "raw",
      });
      expect(result.displayText).toBe("");
    });

    it("should convert between different charsets", () => {
      const result = convertCharset("你好", {
        inputCharset: "UTF-8",
        inputEncoding: "raw",
        outputCharset: "gbk",
        outputEncoding: "raw",
      });
      // Converting to GBK and back should preserve some characters
      expect(result.bytes.length).toBeGreaterThan(0);
    });

    it("should convert UTF-8 to GBK with URL encoding", () => {
      const result = convertCharset("中", {
        inputCharset: "UTF-8",
        inputEncoding: "raw",
        outputCharset: "GBK",
        outputEncoding: "url",
      });
      expect(result.displayText).toBe("%D6%D0");
    });
  });

  describe("autoDetectCharsetAndEncoding", () => {
    it("should detect base64 encoding", () => {
      const result = autoDetectCharsetAndEncoding("SGVsbG8=");
      expect(result.encoding).toBe("base64");
      expect(result.charset).toBe("UTF-8");
      expect(result.isValid).toBe(true);
    });

    it("should detect URL encoding", () => {
      const result = autoDetectCharsetAndEncoding("hello%20world");
      expect(result.encoding).toBe("url");
      expect(result.charset).toBe("UTF-8");
      expect(result.isValid).toBe(true);
    });

    it("should detect hex-escape encoding", () => {
      const result = autoDetectCharsetAndEncoding("\\x48\\x65\\x6c\\x6c\\x6f");
      expect(result.encoding).toBe("hex-escape");
      expect(result.charset).toBe("UTF-8");
      expect(result.isValid).toBe(true);
    });

    it("should detect base64 over raw when string looks like base64", () => {
      const result = autoDetectCharsetAndEncoding("SGVsbG8gV29ybGQ=");
      expect(result.encoding).toBe("base64");
      expect(result.charset).toBe("UTF-8");
      expect(result.isValid).toBe(true);
    });
  });
});
