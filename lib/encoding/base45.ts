// Base45 encoding/decoding (used in EU Digital COVID Certificates)

const BASE45_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";
const BASE45_MAP: Record<string, number> = {};
for (let i = 0; i < BASE45_CHARSET.length; i++) {
  BASE45_MAP[BASE45_CHARSET[i]] = i;
}

export interface Base45Options {
  upperCase?: boolean;
}

export function encodeBase45(
  bytes: Uint8Array,
  options: Base45Options = {},
): string {
  const { upperCase = true } = options;
  if (bytes.length === 0) return "";

  let result = "";
  let i = 0;

  while (i < bytes.length) {
    if (i + 1 < bytes.length) {
      // Two bytes -> three characters
      const n = bytes[i] * 256 + bytes[i + 1];
      const c = n % 45;
      const d = Math.floor(n / 45) % 45;
      const e = Math.floor(n / (45 * 45));
      result += BASE45_CHARSET[c] + BASE45_CHARSET[d] + BASE45_CHARSET[e];
      i += 2;
    } else {
      // One byte -> two characters
      const n = bytes[i];
      const c = n % 45;
      const d = Math.floor(n / 45);
      result += BASE45_CHARSET[c] + BASE45_CHARSET[d];
      i += 1;
    }
  }

  return upperCase ? result : result.toLowerCase();
}

export function decodeBase45(input: string): Uint8Array<ArrayBuffer> {
  const normalized = input.toUpperCase();

  // Validate input
  for (const char of normalized) {
    if (BASE45_MAP[char] === undefined) {
      throw new Error(`Invalid Base45 character: ${char}`);
    }
  }

  const result: number[] = [];
  let i = 0;

  while (i < normalized.length) {
    if (i + 2 < normalized.length) {
      // Three characters -> two bytes
      const c = BASE45_MAP[normalized[i]];
      const d = BASE45_MAP[normalized[i + 1]];
      const e = BASE45_MAP[normalized[i + 2]];
      const n = c + d * 45 + e * 45 * 45;
      if (n > 65535) throw new Error("Invalid Base45 encoding");
      result.push(Math.floor(n / 256));
      result.push(n % 256);
      i += 3;
    } else if (i + 1 < normalized.length) {
      // Two characters -> one byte
      const c = BASE45_MAP[normalized[i]];
      const d = BASE45_MAP[normalized[i + 1]];
      const n = c + d * 45;
      if (n > 255) throw new Error("Invalid Base45 encoding");
      result.push(n);
      i += 2;
    } else {
      throw new Error("Invalid Base45 input length");
    }
  }

  return new Uint8Array(result);
}

export function isValidBase45(input: string): boolean {
  const normalized = input.toUpperCase();
  for (const char of normalized) {
    if (BASE45_MAP[char] === undefined) return false;
  }
  return normalized.length % 3 !== 1;
}
