import { createId, getConstants, init, isCuid } from "@paralleldrive/cuid2";

export interface Cuid2GenerateOptions {
  count: number;
  length?: number;
  fingerprint?: string;
}

export interface Cuid2BatchResult {
  ids: string[];
  error?: string;
}

export interface ParsedCuid2 {
  id: string;
  valid: boolean;
  length: number;
  firstChar: string;
}

const { defaultLength, bigLength } = getConstants();

export function getCuid2Defaults() {
  return {
    defaultLength,
    maxLength: bigLength,
    minLength: 4,
  };
}

function normalizeLength(length?: number): number {
  if (length === undefined) return defaultLength;
  if (!Number.isFinite(length)) {
    throw new Error("Length must be a finite number.");
  }
  const nextLength = Math.trunc(length);
  if (nextLength < 4 || nextLength > bigLength) {
    throw new Error(`Length must be between 4 and ${bigLength}.`);
  }
  return nextLength;
}

export function generateCuid2Batch(
  options: Cuid2GenerateOptions,
): Cuid2BatchResult {
  try {
    if (!Number.isFinite(options.count) || options.count < 1) {
      return { ids: [], error: "Count must be at least 1." };
    }
    const count = Math.min(1000, Math.trunc(options.count));
    const length = normalizeLength(options.length);
    const fingerprint = options.fingerprint?.trim();

    const generator =
      length === defaultLength && !fingerprint
        ? createId
        : init({
            length,
            fingerprint: fingerprint || undefined,
          });

    const ids: string[] = [];
    for (let i = 0; i < count; i += 1) {
      ids.push(generator());
    }

    return { ids };
  } catch (error) {
    console.error(error);
    return {
      ids: [],
      error:
        error instanceof Error
          ? error.message
          : "Failed to generate CUID2 values.",
    };
  }
}

export function isValidCuid2(
  id: string,
  minLength = 4,
  maxLength = bigLength,
): boolean {
  return isCuid(id.trim(), { minLength, maxLength });
}

export function parseCuid2(id: string): ParsedCuid2 {
  const trimmed = id.trim();
  return {
    id: trimmed,
    valid: isValidCuid2(trimmed),
    length: trimmed.length,
    firstChar: trimmed.charAt(0),
  };
}

export function parseCuid2Lines(text: string): ParsedCuid2[] {
  return text
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => parseCuid2(line));
}
