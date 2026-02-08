export type UnicodeNormalizationForm = "NFC" | "NFD" | "NFKC" | "NFKD";

export interface UnicodeCodePoint {
  char: string;
  codePoint: string;
  decimal: number;
}

export interface ConfusableMatch {
  index: number;
  char: string;
  codePoint: string;
  suggestedAscii: string;
  script: "Cyrillic" | "Greek" | "Other";
}

const CONFUSABLE_ASCII_MAP: Record<
  string,
  { ascii: string; script: ConfusableMatch["script"] }
> = {
  а: { ascii: "a", script: "Cyrillic" },
  е: { ascii: "e", script: "Cyrillic" },
  о: { ascii: "o", script: "Cyrillic" },
  р: { ascii: "p", script: "Cyrillic" },
  с: { ascii: "c", script: "Cyrillic" },
  х: { ascii: "x", script: "Cyrillic" },
  у: { ascii: "y", script: "Cyrillic" },
  А: { ascii: "A", script: "Cyrillic" },
  В: { ascii: "B", script: "Cyrillic" },
  Е: { ascii: "E", script: "Cyrillic" },
  К: { ascii: "K", script: "Cyrillic" },
  М: { ascii: "M", script: "Cyrillic" },
  Н: { ascii: "H", script: "Cyrillic" },
  О: { ascii: "O", script: "Cyrillic" },
  Р: { ascii: "P", script: "Cyrillic" },
  С: { ascii: "C", script: "Cyrillic" },
  Т: { ascii: "T", script: "Cyrillic" },
  Х: { ascii: "X", script: "Cyrillic" },
  Υ: { ascii: "Y", script: "Greek" },
  Α: { ascii: "A", script: "Greek" },
  Β: { ascii: "B", script: "Greek" },
  Ε: { ascii: "E", script: "Greek" },
  Ζ: { ascii: "Z", script: "Greek" },
  Η: { ascii: "H", script: "Greek" },
  Ι: { ascii: "I", script: "Greek" },
  Κ: { ascii: "K", script: "Greek" },
  Μ: { ascii: "M", script: "Greek" },
  Ν: { ascii: "N", script: "Greek" },
  Ο: { ascii: "O", script: "Greek" },
  Ρ: { ascii: "P", script: "Greek" },
  Τ: { ascii: "T", script: "Greek" },
  Χ: { ascii: "X", script: "Greek" },
  Ϲ: { ascii: "C", script: "Greek" },
  ϲ: { ascii: "c", script: "Greek" },
};

export function normalizeUnicode(
  text: string,
  form: UnicodeNormalizationForm,
  stripCombiningMarks = false,
): string {
  const normalized = text.normalize(form);
  if (!stripCombiningMarks) {
    return normalized;
  }
  return normalized.normalize("NFD").replace(/\p{M}+/gu, "");
}

export function listCodePoints(text: string): UnicodeCodePoint[] {
  return Array.from(text).map((char) => {
    const decimal = char.codePointAt(0) || 0;
    return {
      char,
      codePoint: `U+${decimal.toString(16).toUpperCase().padStart(4, "0")}`,
      decimal,
    };
  });
}

export function detectConfusableCharacters(text: string): ConfusableMatch[] {
  const matches: ConfusableMatch[] = [];
  const chars = Array.from(text);
  chars.forEach((char, index) => {
    const mapped = CONFUSABLE_ASCII_MAP[char];
    if (!mapped) return;
    const decimal = char.codePointAt(0) || 0;
    matches.push({
      index,
      char,
      codePoint: `U+${decimal.toString(16).toUpperCase().padStart(4, "0")}`,
      suggestedAscii: mapped.ascii,
      script: mapped.script,
    });
  });
  return matches;
}

export function getNormalizationDiff(
  original: string,
  normalized: string,
): { changed: boolean; firstDiffIndex: number } {
  if (original === normalized) {
    return { changed: false, firstDiffIndex: -1 };
  }
  const originalChars = Array.from(original);
  const normalizedChars = Array.from(normalized);
  const maxLength = Math.max(originalChars.length, normalizedChars.length);
  for (let i = 0; i < maxLength; i += 1) {
    if (originalChars[i] !== normalizedChars[i]) {
      return { changed: true, firstDiffIndex: i };
    }
  }
  return { changed: true, firstDiffIndex: -1 };
}
