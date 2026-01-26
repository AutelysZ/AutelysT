// Charset converter utilities for iconv-lite encodings, input/output encoders, and auto-detect helpers.

import chardet from "chardet";
import iconv from "iconv-lite";
import { decodeBase64, detectBase64Options, encodeBase64 } from "./base64";
import { ICONV_ENCODINGS } from "./text-encodings";

export type InputEncodingType = "raw" | "base64" | "hex";
export type OutputEncodingType = "raw" | "base64" | "hex";
export type HexOutputType = "hex" | "hex-escape" | "url";

export type Base64Detection = {
  hasPadding: boolean;
  isUrlSafe: boolean;
};

export type BomDetection = {
  charset: string;
  length: number;
};

export type DetectedCharset = {
  charset: string;
  confidence: number;
  source: "bom" | "chardet";
};

export type ConversionOptions = {
  inputText: string;
  inputEncoding: InputEncodingType;
  inputCharset: string;
  outputCharset: string;
  outputEncoding: OutputEncodingType;
  outputBase64Padding: boolean;
  outputBase64UrlSafe: boolean;
  outputHexType: HexOutputType;
  outputHexUpperCase: boolean;
  outputBom: boolean;
};

export type ConversionResult = {
  inputBytes: Uint8Array;
  outputBytes: Uint8Array;
  outputText: string;
  base64Detection?: Base64Detection;
};

const UNICODE_CHARSETS = [
  "UTF-8",
  "UTF-16BE",
  "UTF-16LE",
  "UTF-32BE",
  "UTF-32LE",
];

const BOM_SIGNATURES: Array<{ charset: string; bytes: number[] }> = [
  { charset: "UTF-8", bytes: [0xef, 0xbb, 0xbf] },
  { charset: "UTF-16LE", bytes: [0xff, 0xfe] },
  { charset: "UTF-16BE", bytes: [0xfe, 0xff] },
  { charset: "UTF-32LE", bytes: [0xff, 0xfe, 0x00, 0x00] },
  { charset: "UTF-32BE", bytes: [0x00, 0x00, 0xfe, 0xff] },
];

const charsetKeyMap = new Map<string, string>();
const charsetOptions = buildCharsetOptions();

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function formatCharsetLabel(value: string) {
  const normalized = normalizeKey(value);
  if (normalized.startsWith("utf")) {
    return value.toUpperCase();
  }
  return value.toUpperCase();
}

function buildCharsetOptions() {
  const seen = new Set<string>();
  const others: string[] = [];

  for (const charset of [...UNICODE_CHARSETS, ...ICONV_ENCODINGS]) {
    const key = normalizeKey(charset);
    if (seen.has(key)) continue;
    seen.add(key);
    charsetKeyMap.set(key, charset);
    if (key === "utf8") continue;
    others.push(charset);
  }

  others.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  return [
    { value: "UTF-8", label: "UTF-8" },
    ...others.map((value) => ({ value, label: formatCharsetLabel(value) })),
  ];
}

export function getCharsetOptions() {
  return charsetOptions;
}

export function normalizeCharsetValue(value: string) {
  if (!value) return "";
  const normalized = normalizeKey(value);
  return charsetKeyMap.get(normalized) ?? value;
}

export function isSupportedCharset(value: string) {
  if (!value) return false;
  const normalized = normalizeKey(value);
  return charsetKeyMap.has(normalized);
}

export function isUnicodeCharset(value: string) {
  const normalized = normalizeKey(value);
  return UNICODE_CHARSETS.some(
    (charset) => normalizeKey(charset) === normalized,
  );
}

function normalizeCharsetForIconv(value: string) {
  const normalized = normalizeKey(value);
  if (normalized === "utf8") return "utf-8";
  if (normalized === "utf16le") return "utf-16le";
  if (normalized === "utf16be") return "utf-16be";
  if (normalized === "utf32le") return "utf-32le";
  if (normalized === "utf32be") return "utf-32be";
  return normalizeCharsetValue(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function detectBom(bytes: Uint8Array): BomDetection | null {
  for (const signature of BOM_SIGNATURES) {
    if (bytes.length < signature.bytes.length) continue;
    let matches = true;
    for (let i = 0; i < signature.bytes.length; i += 1) {
      if (bytes[i] !== signature.bytes[i]) {
        matches = false;
        break;
      }
    }
    if (matches) {
      return { charset: signature.charset, length: signature.bytes.length };
    }
  }
  return null;
}

export function stripBom(bytes: Uint8Array) {
  const bom = detectBom(bytes);
  if (!bom)
    return { bytes, bom: null } as {
      bytes: Uint8Array;
      bom: BomDetection | null;
    };
  return { bytes: bytes.slice(bom.length), bom } as {
    bytes: Uint8Array;
    bom: BomDetection | null;
  };
}

export function decodeBase64Auto(input: string) {
  const detection = detectBase64Options(input);
  const bytes = decodeBase64(input);
  return { bytes, detection };
}

export function decodeHexInput(input: string): Uint8Array {
  const trimmed = input.trim();
  if (!trimmed) return new Uint8Array();

  const hasEscape = /\\x/i.test(trimmed);
  const hasPercent = /%[0-9a-fA-F]{2}/.test(trimmed);

  if (hasEscape || hasPercent) {
    const regex = /\\x([0-9a-fA-F]{2})|%([0-9a-fA-F]{2})/g;
    const bytes: number[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(trimmed)) !== null) {
      if (match.index > lastIndex) {
        const between = trimmed.slice(lastIndex, match.index);
        if (between.trim().length > 0) {
          throw new Error("Invalid hex input");
        }
      }
      const hexValue = match[1] ?? match[2];
      bytes.push(Number.parseInt(hexValue, 16));
      lastIndex = match.index + match[0].length;
    }

    if (
      lastIndex < trimmed.length &&
      trimmed.slice(lastIndex).trim().length > 0
    ) {
      throw new Error("Invalid hex input");
    }

    return new Uint8Array(bytes);
  }

  const compact = trimmed.replace(/\s+/g, "");
  if (compact.length % 2 !== 0) {
    throw new Error("Invalid hex input");
  }

  const bytes = new Uint8Array(compact.length / 2);
  for (let i = 0; i < compact.length; i += 2) {
    const pair = compact.slice(i, i + 2);
    if (!/^[0-9a-fA-F]{2}$/.test(pair)) {
      throw new Error("Invalid hex input");
    }
    bytes[i / 2] = Number.parseInt(pair, 16);
  }
  return bytes;
}

export function encodeHexOutput(
  bytes: Uint8Array,
  format: HexOutputType,
  upperCase: boolean,
) {
  const toHex = (byte: number) =>
    byte
      .toString(16)
      .padStart(2, "0")
      [upperCase ? "toUpperCase" : "toLowerCase"]();

  if (format === "hex-escape") {
    return Array.from(bytes)
      .map((byte) => `\\x${toHex(byte)}`)
      .join("");
  }

  if (format === "url") {
    return Array.from(bytes)
      .map((byte) => `%${toHex(byte)}`)
      .join("");
  }

  return Array.from(bytes)
    .map((byte) => toHex(byte))
    .join("");
}

export function decodeInputEncodingToBytes(
  input: string,
  encoding: InputEncodingType,
): { bytes: Uint8Array; base64Detection?: Base64Detection } {
  if (!input) return { bytes: new Uint8Array() };

  if (encoding === "raw") {
    return { bytes: new TextEncoder().encode(input) };
  }

  if (encoding === "base64") {
    const { bytes, detection } = decodeBase64Auto(input);
    return { bytes, base64Detection: detection };
  }

  return { bytes: decodeHexInput(input) };
}

export function decodeBytesToText(bytes: Uint8Array, charset: string) {
  const normalized = normalizeKey(charset);
  if (normalized === "utf8") {
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  }
  if (normalized === "utf16le") {
    return new TextDecoder("utf-16le", { fatal: false }).decode(bytes);
  }
  if (normalized === "utf16be") {
    return new TextDecoder("utf-16be", { fatal: false }).decode(bytes);
  }
  if (normalized === "utf32le" || normalized === "utf32be") {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const chars: string[] = [];
    for (let i = 0; i + 4 <= bytes.length; i += 4) {
      const codePoint = view.getUint32(i, normalized === "utf32le");
      chars.push(String.fromCodePoint(codePoint));
    }
    return chars.join("");
  }

  try {
    return iconv.decode(Buffer.from(bytes), normalizeCharsetForIconv(charset));
  } catch (error) {
    console.error("Failed to decode bytes", error);
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  }
}

export function encodeTextToBytes(text: string, charset: string) {
  const normalized = normalizeKey(charset);
  if (normalized === "utf8") {
    return new TextEncoder().encode(text);
  }
  if (normalized === "utf16le") {
    const buffer = new ArrayBuffer(text.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < text.length; i += 1) {
      view.setUint16(i * 2, text.charCodeAt(i), true);
    }
    return new Uint8Array(buffer);
  }
  if (normalized === "utf16be") {
    const buffer = new ArrayBuffer(text.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < text.length; i += 1) {
      view.setUint16(i * 2, text.charCodeAt(i), false);
    }
    return new Uint8Array(buffer);
  }
  if (normalized === "utf32le" || normalized === "utf32be") {
    const codePoints = Array.from(text).map((char) => char.codePointAt(0) ?? 0);
    const buffer = new ArrayBuffer(codePoints.length * 4);
    const view = new DataView(buffer);
    codePoints.forEach((codePoint, index) => {
      view.setUint32(index * 4, codePoint, normalized === "utf32le");
    });
    return new Uint8Array(buffer);
  }

  try {
    return iconv.encode(text, normalizeCharsetForIconv(charset));
  } catch (error) {
    console.error("Failed to encode text", error);
    return new TextEncoder().encode(text);
  }
}

export function getOutputBytesWithBom(
  bytes: Uint8Array,
  charset: string,
  includeBom: boolean,
) {
  if (!includeBom || !isUnicodeCharset(charset)) return bytes;
  const normalized = normalizeKey(charset);
  const signature = BOM_SIGNATURES.find(
    (item) => normalizeKey(item.charset) === normalized,
  );
  if (!signature) return bytes;
  const bomBytes = new Uint8Array(signature.bytes);
  const output = new Uint8Array(bomBytes.length + bytes.length);
  output.set(bomBytes, 0);
  output.set(bytes, bomBytes.length);
  return output;
}

export function encodeOutput(
  bytes: Uint8Array,
  encoding: OutputEncodingType,
  options: {
    outputBase64Padding: boolean;
    outputBase64UrlSafe: boolean;
    outputHexType: HexOutputType;
    outputHexUpperCase: boolean;
    outputCharset: string;
  },
) {
  if (encoding === "base64") {
    return encodeBase64(bytes, {
      padding: options.outputBase64Padding,
      urlSafe: options.outputBase64UrlSafe,
    });
  }

  if (encoding === "hex") {
    return encodeHexOutput(
      bytes,
      options.outputHexType,
      options.outputHexUpperCase,
    );
  }

  return decodeBytesToText(bytes, options.outputCharset);
}

export function convertCharset(options: ConversionOptions): ConversionResult {
  const inputCharset = normalizeCharsetValue(options.inputCharset);
  const outputCharset = normalizeCharsetValue(options.outputCharset);
  const inputText = options.inputText ?? "";

  let inputBytes: Uint8Array;
  let base64Detection: Base64Detection | undefined;

  if (options.inputEncoding === "raw") {
    inputBytes = encodeTextToBytes(inputText, inputCharset);
  } else if (options.inputEncoding === "base64") {
    const decoded = decodeBase64Auto(inputText);
    inputBytes = decoded.bytes;
    base64Detection = decoded.detection;
  } else {
    inputBytes = decodeHexInput(inputText);
  }

  const stripped = stripBom(inputBytes);
  const decodedText = decodeBytesToText(stripped.bytes, inputCharset);
  const outputBytes = encodeTextToBytes(decodedText, outputCharset);
  const outputWithBom = getOutputBytesWithBom(
    outputBytes,
    outputCharset,
    options.outputBom,
  );

  const outputText = encodeOutput(outputWithBom, options.outputEncoding, {
    outputBase64Padding: options.outputBase64Padding,
    outputBase64UrlSafe: options.outputBase64UrlSafe,
    outputHexType: options.outputHexType,
    outputHexUpperCase: options.outputHexUpperCase,
    outputCharset: outputCharset,
  });

  return {
    inputBytes,
    outputBytes: outputWithBom,
    outputText,
    base64Detection,
  };
}

export function detectCharsets(bytes: Uint8Array) {
  const { bytes: stripped, bom } = stripBom(bytes);
  const results = chardet.analyse(Buffer.from(stripped));
  const seen = new Map<string, DetectedCharset>();

  for (const result of results) {
    const charset = normalizeCharsetValue(result.name);
    if (!isSupportedCharset(charset)) continue;
    const confidence =
      result.confidence > 1 ? result.confidence / 100 : result.confidence;
    const current = seen.get(charset);
    if (!current || confidence > current.confidence) {
      seen.set(charset, { charset, confidence, source: "chardet" });
    }
  }

  const detected = Array.from(seen.values()).sort(
    (a, b) => b.confidence - a.confidence,
  );
  if (bom) {
    const bomCharset = normalizeCharsetValue(bom.charset);
    const filtered = detected.filter(
      (item) => normalizeCharsetValue(item.charset) !== bomCharset,
    );
    filtered.unshift({ charset: bomCharset, confidence: 1, source: "bom" });
    return { bom, detected: filtered };
  }

  return { bom, detected };
}

export function getDownloadPayload(
  outputText: string,
  outputBytes: Uint8Array,
  outputEncoding: OutputEncodingType,
) {
  if (outputEncoding === "raw") {
    return { content: outputBytes, mimeType: "application/octet-stream" };
  }
  return { content: outputText, mimeType: "text/plain" };
}
