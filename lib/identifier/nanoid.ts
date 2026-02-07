import { nanoid, customAlphabet } from "nanoid";

export const DEFAULT_NANOID_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";

export type NanoIdGenerateOptions = {
  count: number;
  length: number;
  alphabet?: string;
};

export type NanoIdGenerateResult = {
  ids: string[];
  error?: string;
};

export function generateNanoIDs(
  options: NanoIdGenerateOptions,
): NanoIdGenerateResult {
  const count = Number.isFinite(options.count) ? options.count : 0;
  const length = Number.isFinite(options.length) ? options.length : 0;
  const alphabet =
    options.alphabet !== undefined ? options.alphabet : DEFAULT_NANOID_ALPHABET;

  if (count < 1) {
    return { ids: [], error: "Count must be at least 1." };
  }
  if (length < 1) {
    return { ids: [], error: "Length must be at least 1." };
  }

  const uniqueCount = new Set(Array.from(alphabet)).size;
  if (uniqueCount < 2) {
    return {
      ids: [],
      error: "Alphabet must contain at least 2 unique characters.",
    };
  }

  const ids: string[] = [];
  if (alphabet === DEFAULT_NANOID_ALPHABET) {
    for (let i = 0; i < count; i++) {
      ids.push(nanoid(length));
    }
    return { ids };
  }

  const generator = customAlphabet(alphabet, length);
  for (let i = 0; i < count; i++) {
    ids.push(generator());
  }

  return { ids };
}
