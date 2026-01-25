// Hexadecimal (Base16) encoding/decoding

export interface HexOptions {
  upperCase?: boolean;
}

export function encodeHex(bytes: Uint8Array, options: HexOptions = {}): string {
  const { upperCase = true } = options;

  let result = "";
  for (const byte of bytes) {
    result += byte.toString(16).padStart(2, "0");
  }

  return upperCase ? result.toUpperCase() : result.toLowerCase();
}

export function decodeHex(input: string): Uint8Array<ArrayBuffer> {
  // Remove any whitespace
  const normalized = input.replace(/\s/g, "");

  // Validate input
  if (!/^[0-9a-fA-F]*$/.test(normalized)) {
    throw new Error("Invalid hexadecimal characters");
  }

  if (normalized.length % 2 !== 0) {
    throw new Error("Hex string must have even length");
  }

  const result = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < normalized.length; i += 2) {
    result[i / 2] = Number.parseInt(normalized.slice(i, i + 2), 16);
  }

  return result;
}

export function isValidHex(input: string): boolean {
  const normalized = input.replace(/\s/g, "");
  return /^[0-9a-fA-F]*$/.test(normalized) && normalized.length % 2 === 0;
}
