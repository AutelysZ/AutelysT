const IDENTIFIER_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const ESCAPED_CONTROL_PATTERN = /\\u([0-9a-fA-F]{4})|\\n|\\r|\\t|\\f|\\b/g;

export function buildJsonPath(keys: Array<string | number>): string {
  if (keys.length === 0) {
    return "$";
  }

  let path = "$";
  for (const key of keys) {
    if (typeof key === "number") {
      path += `[${key}]`;
      continue;
    }

    if (IDENTIFIER_PATTERN.test(key)) {
      path += `.${key}`;
      continue;
    }

    const escapedKey = key.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
    path += `["${escapedKey}"]`;
  }

  return path;
}

export function clampCollapseDepth(value: number, min = 1, max = 8): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  const integer = Math.trunc(value);
  return Math.min(max, Math.max(min, integer));
}

export function formatJsonForDisplay(value: unknown): string {
  if (value === undefined) {
    return "undefined";
  }
  if (typeof value === "number" && Number.isNaN(value)) {
    return "NaN";
  }
  if (value === Infinity) {
    return "Infinity";
  }
  if (value === -Infinity) {
    return "-Infinity";
  }
  if (typeof value === "bigint") {
    return `${value.toString()}n`;
  }
  return JSON.stringify(value, null, 2) ?? String(value);
}

export function decodeEscapedStringForDisplay(value: string): string {
  return value.replace(
    ESCAPED_CONTROL_PATTERN,
    (token: string, unicodeHex?: string) => {
      if (unicodeHex) {
        return String.fromCharCode(Number.parseInt(unicodeHex, 16));
      }
      switch (token) {
        case "\\n":
          return "\n";
        case "\\r":
          return "\r";
        case "\\t":
          return "\t";
        case "\\f":
          return "\f";
        case "\\b":
          return "\b";
        default:
          return token;
      }
    },
  );
}
