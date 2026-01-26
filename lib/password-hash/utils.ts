import { decodeBase64, encodeBase64 } from "../encoding/base64";

export function utf8ToBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

export function bytesToUtf8(value: Uint8Array): string {
  return new TextDecoder().decode(value);
}

export function randomBytes(length: number): Uint8Array {
  if (length <= 0) return new Uint8Array();
  const cryptoObj =
    globalThis.crypto || (globalThis as { msCrypto?: Crypto }).msCrypto;
  if (!cryptoObj?.getRandomValues) {
    throw new Error("Secure random generator is not available.");
  }
  const bytes = new Uint8Array(length);
  cryptoObj.getRandomValues(bytes);
  return bytes;
}

export function encodeBase64NoPadding(bytes: Uint8Array): string {
  return encodeBase64(bytes, { padding: false });
}

export function decodeBase64ToBytes(value: string): Uint8Array {
  return decodeBase64(value);
}

export function isPowerOfTwo(value: number): boolean {
  return Number.isInteger(value) && value > 0 && (value & (value - 1)) === 0;
}

export function toPositiveInt(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  const rounded = Math.floor(value);
  return rounded > 0 ? rounded : fallback;
}
