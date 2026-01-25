// Radix (base) conversion utilities

export interface RadixOptions {
  upperCase?: boolean;
  padding?: number; // 0, 1, 2, 4, 8
}

// Convert a number string from one base to another
export function convertRadix(
  value: string,
  fromBase: number,
  toBase: number,
  options: RadixOptions = {},
): string {
  const { upperCase = true, padding = 0 } = options;

  if (fromBase < 2 || fromBase > 36 || toBase < 2 || toBase > 36) {
    throw new Error("Base must be between 2 and 36");
  }

  // Parse input to BigInt
  const normalized = value.trim().toUpperCase();
  if (!normalized) return "";

  // Validate input characters for the given base
  const validChars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ".slice(0, fromBase);
  for (const char of normalized) {
    if (!validChars.includes(char)) {
      throw new Error(`Invalid character '${char}' for base ${fromBase}`);
    }
  }

  // Convert to decimal (BigInt)
  let decimal = BigInt(0);
  for (const char of normalized) {
    const digit =
      char >= "A" ? char.charCodeAt(0) - 55 : char.charCodeAt(0) - 48;
    decimal = decimal * BigInt(fromBase) + BigInt(digit);
  }

  // Convert from decimal to target base
  if (decimal === BigInt(0)) {
    const result = "0";
    return padding > 0 ? result.padStart(padding, "0") : result;
  }

  let result = "";
  let temp = decimal;
  while (temp > 0) {
    const remainder = Number(temp % BigInt(toBase));
    const digit =
      remainder < 10 ? String(remainder) : String.fromCharCode(55 + remainder);
    result = digit + result;
    temp = temp / BigInt(toBase);
  }

  // Apply padding
  if (padding > 0) {
    result = result.padStart(Math.ceil(result.length / padding) * padding, "0");
  }

  return upperCase ? result : result.toLowerCase();
}

// Format number as base60 (time-like: xx:xx:xx)
export function toBase60(value: bigint, padding: 0 | 2 = 0): string {
  if (value === BigInt(0)) {
    return padding === 2 ? "00" : "0";
  }

  const parts: string[] = [];
  let temp = value;

  while (temp > 0) {
    const part = Number(temp % BigInt(60));
    parts.unshift(
      padding === 2 ? part.toString().padStart(2, "0") : part.toString(),
    );
    temp = temp / BigInt(60);
  }

  return parts.join(":");
}

// Parse base60 string to BigInt
export function fromBase60(value: string): bigint {
  const parts = value.split(":").filter((p) => p.length > 0);

  if (parts.length === 0) return BigInt(0);

  let result = BigInt(0);
  for (const part of parts) {
    const num = Number.parseInt(part, 10);
    if (isNaN(num) || num < 0 || num >= 60) {
      throw new Error(`Invalid base60 segment: ${part}`);
    }
    result = result * BigInt(60) + BigInt(num);
  }

  return result;
}

// Validate base60 format
export function isValidBase60(value: string): boolean {
  const parts = value.split(":");
  for (const part of parts) {
    if (part.length === 0) continue;
    const num = Number.parseInt(part, 10);
    if (isNaN(num) || num < 0 || num >= 60) return false;
  }
  return true;
}
