import { encodeBase32 } from "@/lib/encoding/base32";
import { encodeBase45 } from "@/lib/encoding/base45";
import { encodeBase58 } from "@/lib/encoding/base58";
import { encodeBase64 } from "@/lib/encoding/base64";
import { encodeHex } from "@/lib/encoding/hex";

export type PasswordSerialization =
  | "graphic-ascii"
  | "base64"
  | "hex"
  | "base58"
  | "base45"
  | "base32";
export type CaseMode = "lower" | "upper";
export type LengthType = "bytes" | "chars";

export interface PasswordGeneratorOptions {
  serialization: PasswordSerialization;
  base64NoPadding: boolean;
  base64UrlSafe: boolean;
  base32NoPadding: boolean;
  caseMode: CaseMode;
  symbols: string;
  includeSymbols: boolean;
  includeUpper: boolean;
  includeLower: boolean;
  includeNumbers: boolean;
  lengthType: LengthType;
  length: number;
}

export interface PasswordGenerationResult {
  value: string;
  error?: string;
}

export const DEFAULT_SYMBOLS = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~";

const BASE64_STANDARD =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const BASE64_URLSAFE =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE45_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const HEX_ALPHABET_LOWER = "0123456789abcdef";
const HEX_ALPHABET_UPPER = "0123456789ABCDEF";

function uniqueChars(value: string): string {
  const seen = new Set<string>();
  let result = "";
  for (const char of value) {
    if (!seen.has(char)) {
      seen.add(char);
      result += char;
    }
  }
  return result;
}

function getRandomUint32(): number {
  const array = new Uint32Array(1);
  globalThis.crypto.getRandomValues(array);
  return array[0];
}

function randomFromCharset(length: number, charset: string): string {
  const unique = uniqueChars(charset);
  if (!unique) return "";

  const max = unique.length;
  const limit = Math.floor(0xffffffff / max) * max;
  let result = "";

  while (result.length < length) {
    const value = getRandomUint32();
    if (value >= limit) continue;
    result += unique[value % max];
  }

  return result;
}

function getRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

function buildGraphicAsciiCharset(options: PasswordGeneratorOptions): string {
  let charset = "";
  if (options.includeUpper) charset += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (options.includeLower) charset += "abcdefghijklmnopqrstuvwxyz";
  if (options.includeNumbers) charset += "0123456789";
  if (options.includeSymbols && options.symbols) charset += options.symbols;
  return uniqueChars(charset);
}

export function generatePassword(
  options: PasswordGeneratorOptions,
): PasswordGenerationResult {
  const length = Math.max(1, Math.min(1024, Math.floor(options.length)));

  if (options.serialization === "graphic-ascii") {
    const charset = buildGraphicAsciiCharset(options);
    if (!charset) {
      return {
        value: "",
        error: "Select at least one character group or add symbols.",
      };
    }
    return { value: randomFromCharset(length, charset) };
  }

  if (options.lengthType === "chars") {
    switch (options.serialization) {
      case "base64": {
        const alphabet = options.base64UrlSafe
          ? BASE64_URLSAFE
          : BASE64_STANDARD;
        const charset = options.base64NoPadding ? alphabet : alphabet + "=";
        return { value: randomFromCharset(length, charset) };
      }
      case "hex": {
        const charset =
          options.caseMode === "upper"
            ? HEX_ALPHABET_UPPER
            : HEX_ALPHABET_LOWER;
        return { value: randomFromCharset(length, charset) };
      }
      case "base58":
        return { value: randomFromCharset(length, BASE58_ALPHABET) };
      case "base45": {
        const charset =
          options.caseMode === "upper"
            ? BASE45_ALPHABET
            : BASE45_ALPHABET.toLowerCase();
        return { value: randomFromCharset(length, charset) };
      }
      case "base32": {
        const charset =
          options.caseMode === "upper"
            ? BASE32_ALPHABET
            : BASE32_ALPHABET.toLowerCase();
        return { value: randomFromCharset(length, charset) };
      }
    }
  }

  const bytes = getRandomBytes(length);
  switch (options.serialization) {
    case "base64":
      return {
        value: encodeBase64(bytes, {
          padding: !options.base64NoPadding,
          urlSafe: options.base64UrlSafe,
        }),
      };
    case "hex":
      return {
        value: encodeHex(bytes, { upperCase: options.caseMode === "upper" }),
      };
    case "base58":
      return { value: encodeBase58(bytes) };
    case "base45":
      return {
        value: encodeBase45(bytes, { upperCase: options.caseMode === "upper" }),
      };
    case "base32":
      return {
        value: encodeBase32(bytes, {
          upperCase: options.caseMode === "upper",
          padding: !options.base32NoPadding,
        }),
      };
    default:
      return { value: "" };
  }
}
