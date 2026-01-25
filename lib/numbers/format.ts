// Number format conversion utilities using nzh for Chinese numbers
import Nzh from "nzh";

export type NumberFormat =
  | "plain"
  | "comma"
  | "dot"
  | "iso"
  | "chinese-lower"
  | "chinese-upper"
  | "roman"
  | "scientific"
  | "engineering"
  | "japanese"
  | "korean"
  | "indian";

export type EngineeringUnit = "P" | "T" | "G" | "M" | "K" | "h";

const JAPANESE_DIGITS = [
  "〇",
  "一",
  "二",
  "三",
  "四",
  "五",
  "六",
  "七",
  "八",
  "九",
];
const KOREAN_DIGITS = [
  "영",
  "일",
  "이",
  "삼",
  "사",
  "오",
  "육",
  "칠",
  "팔",
  "구",
];

const ROMAN_VALUES: [number, string][] = [
  [1000, "M"],
  [900, "CM"],
  [500, "D"],
  [400, "CD"],
  [100, "C"],
  [90, "XC"],
  [50, "L"],
  [40, "XL"],
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

const ENGINEERING_MULTIPLIERS: Record<EngineeringUnit, number> = {
  P: 1e15,
  T: 1e12,
  G: 1e9,
  M: 1e6,
  K: 1e3,
  h: 1, // human-readable auto-scaling
};

// Parse a formatted number to a plain number
export function parseFormattedNumber(
  value: string,
  format: NumberFormat,
): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;

  switch (format) {
    case "plain":
      return Number.parseFloat(trimmed);

    case "comma":
      return Number.parseFloat(trimmed.replace(/,/g, ""));

    case "dot":
      // European format: dots for thousands, comma for decimal
      return Number.parseFloat(trimmed.replace(/\./g, "").replace(",", "."));

    case "iso":
      // ISO format: spaces for thousands
      return Number.parseFloat(trimmed.replace(/\s/g, ""));

    case "indian":
      return Number.parseFloat(trimmed.replace(/,/g, ""));

    case "chinese-lower": {
      const decoded = Nzh.cn.decodeS(trimmed);
      return typeof decoded === "number" ? decoded : Number(decoded) || 0;
    }

    case "chinese-upper": {
      const decoded = Nzh.cn.decodeB(trimmed);
      return typeof decoded === "number" ? decoded : Number(decoded) || 0;
    }

    case "roman":
      return parseRomanNumeral(trimmed);

    case "scientific":
      return Number.parseFloat(trimmed);

    case "engineering":
      return parseEngineeringNumber(trimmed);

    case "japanese":
      return parseJapaneseNumber(trimmed);

    case "korean":
      return parseKoreanNumber(trimmed);

    default:
      return Number.parseFloat(trimmed);
  }
}

// Format a number according to the specified format
export function formatNumber(
  value: number,
  format: NumberFormat,
  unit?: EngineeringUnit,
): string {
  if (isNaN(value)) return "";

  switch (format) {
    case "plain":
      return value.toString();

    case "comma":
      return formatWithSeparator(value, ",", ".");

    case "dot":
      return formatWithSeparator(value, ".", ",");

    case "iso":
      return formatWithSeparator(value, " ", ".");

    case "indian":
      return formatIndian(value);

    case "chinese-lower":
      return Nzh.cn.encodeS(value);

    case "chinese-upper":
      return Nzh.cn.encodeB(value);

    case "roman":
      return toRomanNumeral(Math.floor(value));

    case "scientific":
      return value.toExponential();

    case "engineering":
      return toEngineeringNotation(value, unit || "h");

    case "japanese":
      return toJapaneseNumber(Math.floor(value));

    case "korean":
      return toKoreanNumber(Math.floor(value));

    default:
      return value.toString();
  }
}

function formatWithSeparator(
  value: number,
  thousandSep: string,
  decimalSep: string,
): string {
  const [intPart, decPart] = value.toString().split(".");
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandSep);
  return decPart ? `${formatted}${decimalSep}${decPart}` : formatted;
}

function formatIndian(value: number): string {
  const [intPart, decPart] = value.toString().split(".");
  // Indian system: first group of 3, then groups of 2
  let result = intPart.slice(-3);
  let remaining = intPart.slice(0, -3);
  while (remaining.length > 0) {
    result = remaining.slice(-2) + "," + result;
    remaining = remaining.slice(0, -2);
  }
  return decPart ? `${result}.${decPart}` : result;
}

function toRomanNumeral(n: number): string {
  if (n <= 0 || n > 3999) return n.toString();

  let result = "";
  let remaining = n;

  for (const [value, numeral] of ROMAN_VALUES) {
    while (remaining >= value) {
      result += numeral;
      remaining -= value;
    }
  }

  return result;
}

function parseRomanNumeral(str: string): number {
  const values: Record<string, number> = {
    I: 1,
    V: 5,
    X: 10,
    L: 50,
    C: 100,
    D: 500,
    M: 1000,
  };

  let result = 0;
  const upper = str.toUpperCase();

  for (let i = 0; i < upper.length; i++) {
    const current = values[upper[i]] || 0;
    const next = values[upper[i + 1]] || 0;

    if (current < next) {
      result -= current;
    } else {
      result += current;
    }
  }

  return result;
}

function toEngineeringNotation(n: number, unit: EngineeringUnit): string {
  if (unit === "h") {
    // Human-readable auto-scaling
    const units: [number, string][] = [
      [1e15, "P"],
      [1e12, "T"],
      [1e9, "G"],
      [1e6, "M"],
      [1e3, "K"],
    ];

    for (const [threshold, suffix] of units) {
      if (Math.abs(n) >= threshold) {
        return (n / threshold).toFixed(2).replace(/\.?0+$/, "") + suffix;
      }
    }
    return n.toString();
  }

  const multiplier = ENGINEERING_MULTIPLIERS[unit];
  return (n / multiplier).toFixed(2).replace(/\.?0+$/, "") + unit;
}

function parseEngineeringNumber(str: string): number {
  const match = str.match(/^([\d.]+)\s*([PTGMK])?$/i);
  if (!match) return Number.parseFloat(str);

  const num = Number.parseFloat(match[1]);
  const unit = match[2]?.toUpperCase() as EngineeringUnit | undefined;

  if (unit && ENGINEERING_MULTIPLIERS[unit]) {
    return num * ENGINEERING_MULTIPLIERS[unit];
  }

  return num;
}

function toJapaneseNumber(n: number): string {
  if (n === 0) return JAPANESE_DIGITS[0];
  return n
    .toString()
    .split("")
    .map((d) => JAPANESE_DIGITS[Number.parseInt(d)])
    .join("");
}

function parseJapaneseNumber(str: string): number {
  const map: Record<string, number> = {};
  JAPANESE_DIGITS.forEach((d, i) => (map[d] = i));

  return Number.parseInt(
    str
      .split("")
      .map((c) => (map[c] !== undefined ? map[c].toString() : c))
      .join(""),
    10,
  );
}

function toKoreanNumber(n: number): string {
  if (n === 0) return KOREAN_DIGITS[0];
  return n
    .toString()
    .split("")
    .map((d) => KOREAN_DIGITS[Number.parseInt(d)])
    .join("");
}

function parseKoreanNumber(str: string): number {
  const map: Record<string, number> = {};
  KOREAN_DIGITS.forEach((d, i) => (map[d] = i));

  return Number.parseInt(
    str
      .split("")
      .map((c) => (map[c] !== undefined ? map[c].toString() : c))
      .join(""),
    10,
  );
}

export const NUMBER_FORMATS: { value: NumberFormat; label: string }[] = [
  { value: "plain", label: "Plain (no grouping)" },
  { value: "comma", label: "Thousands with comma (1,234,567)" },
  { value: "dot", label: "Thousands with dot (1.234.567)" },
  { value: "iso", label: "ISO grouping (1 234 567)" },
  { value: "chinese-lower", label: "Chinese lowercase (一二三)" },
  { value: "chinese-upper", label: "Chinese uppercase (壹贰叁)" },
  { value: "roman", label: "Roman numerals (MCMLXXXIV)" },
  { value: "scientific", label: "Scientific notation (1.23e+6)" },
  { value: "engineering", label: "Engineering notation (1.23M)" },
  { value: "japanese", label: "Japanese (一二三)" },
  { value: "korean", label: "Korean (일이삼)" },
  { value: "indian", label: "Indian grouping (12,34,567)" },
];

export const ENGINEERING_UNITS: { value: EngineeringUnit; label: string }[] = [
  { value: "h", label: "Auto (human-readable)" },
  { value: "P", label: "P (Peta, 10¹⁵)" },
  { value: "T", label: "T (Tera, 10¹²)" },
  { value: "G", label: "G (Giga, 10⁹)" },
  { value: "M", label: "M (Mega, 10⁶)" },
  { value: "K", label: "K (Kilo, 10³)" },
];
