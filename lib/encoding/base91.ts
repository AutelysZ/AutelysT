import base91 from "node-base91";
import { Buffer } from "buffer";

const BASE91_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&()*+,./:;<=>?@[]^_`{|}~"';
const BASE91_CHAR_SET = new Set(Array.from(BASE91_ALPHABET));

function stripWhitespace(value: string): string {
  return value.replace(/\s+/g, "");
}

export function encodeBase91(bytes: Uint8Array): string {
  const result = base91.encode(Buffer.from(bytes));
  if (!result || typeof result !== "string") {
    throw new Error("Failed to encode Base91 input");
  }
  return result;
}

export function decodeBase91(value: string): Uint8Array {
  if (!isValidBase91(value)) {
    throw new Error("Invalid Base91 input");
  }
  const result = base91.decode(value);
  if (!result || typeof result === "string") {
    throw new Error("Failed to decode Base91 input");
  }
  return new Uint8Array(result);
}

export function isValidBase91(value: string): boolean {
  try {
    const compact = stripWhitespace(value);
    if (!compact) return false;
    for (const char of compact) {
      if (!BASE91_CHAR_SET.has(char)) return false;
    }
    return true;
  } catch {
    return false;
  }
}
