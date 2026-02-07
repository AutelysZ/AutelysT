import base85 from "base85";
import { Buffer } from "buffer";

export type Base85Variant = "ascii85" | "a85" | "z85";

const ASCII85_PREFIX = "<~";
const ASCII85_SUFFIX = "~>";

function normalizeEncoding(variant: Base85Variant): "ascii85" | "z85" {
  return variant === "a85" ? "ascii85" : variant;
}

function stripAscii85Frame(value: string): string {
  if (value.startsWith(ASCII85_PREFIX) && value.endsWith(ASCII85_SUFFIX)) {
    return value.slice(ASCII85_PREFIX.length, -ASCII85_SUFFIX.length);
  }
  return value;
}

function addAscii85Frame(value: string): string {
  return `${ASCII85_PREFIX}${value}${ASCII85_SUFFIX}`;
}

export function encodeBase85(
  bytes: Uint8Array,
  variant: Base85Variant,
): string {
  const result = base85.encode(Buffer.from(bytes), normalizeEncoding(variant));
  if (!result || typeof result !== "string") {
    throw new Error("Failed to encode Base85 input");
  }
  return variant === "a85" ? stripAscii85Frame(result) : result;
}

export function decodeBase85(
  value: string,
  variant: Base85Variant,
): Uint8Array {
  const input =
    variant === "a85" ? addAscii85Frame(stripAscii85Frame(value)) : value;
  const result = base85.decode(input, normalizeEncoding(variant));
  if (!result || typeof result === "string") {
    throw new Error("Failed to decode Base85 input");
  }
  return new Uint8Array(result);
}

export function isValidBase85(value: string, variant: Base85Variant): boolean {
  try {
    const input =
      variant === "a85" ? addAscii85Frame(stripAscii85Frame(value)) : value;
    const result = base85.decode(input, normalizeEncoding(variant));
    return Boolean(result) && typeof result !== "string";
  } catch {
    return false;
  }
}
