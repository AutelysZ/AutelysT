import * as yaml from "js-yaml";
import * as toml from "@iarna/toml";

export type FormatType = "json" | "yaml" | "toml";

export function detectFormat(input: string): FormatType | null {
  const trimmed = input.trim();

  // Try JSON first
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      JSON.parse(trimmed);
      return "json";
    } catch {}
  }

  // Try TOML (typically has = signs and [sections])
  if (
    trimmed.includes("=") &&
    (trimmed.includes("[") || /^\w+\s*=/m.test(trimmed))
  ) {
    try {
      toml.parse(trimmed);
      return "toml";
    } catch {}
  }

  // Try YAML (most permissive, try last)
  try {
    const parsed = yaml.load(trimmed);
    if (typeof parsed === "object" && parsed !== null) {
      return "yaml";
    }
  } catch {}

  return null;
}

export function parseInput(input: string, format: FormatType): unknown {
  switch (format) {
    case "json":
      return JSON.parse(input);
    case "yaml":
      return yaml.load(input);
    case "toml":
      return toml.parse(input);
  }
}

export function formatOutput(data: unknown, format: FormatType): string {
  switch (format) {
    case "json":
      return JSON.stringify(data, null, 2);
    case "yaml":
      return yaml.dump(data, { indent: 2, lineWidth: -1 });
    case "toml":
      return toml.stringify(data as toml.JsonMap);
  }
}

export function convert(
  input: string,
  fromFormat: FormatType,
  toFormat: FormatType,
): string {
  const data = parseInput(input, fromFormat);
  return formatOutput(data, toFormat);
}
