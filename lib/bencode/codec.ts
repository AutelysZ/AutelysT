import bencode from "bencode";
import * as yaml from "js-yaml";
import { decodeBase64, encodeBase64 } from "../encoding/base64";
import { decodeHex, encodeHex } from "../encoding/hex";

// ============================================================================
// Types
// ============================================================================

export type InputEncoding = "base64" | "hex" | "binary";
export type OutputEncoding = "binary" | "base64" | "base64url" | "hex";
export type InputFormat = "json" | "yaml";
export type OutputFormat = "json" | "yaml";

export type BencodeField = {
  path: string;
  type: string;
  value: unknown;
  children?: BencodeField[];
};

// ============================================================================
// Input/Output Encoding
// ============================================================================

export function decodeInputData(
  data: string,
  encoding: InputEncoding,
): Uint8Array {
  if (encoding === "binary") {
    throw new Error("Binary input requires file upload");
  }

  if (!data.trim()) return new Uint8Array();

  if (encoding === "hex") {
    return decodeHex(data.replace(/\s+/g, ""));
  }

  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  return decodeBase64(normalized);
}

export function encodeOutputData(
  data: Uint8Array,
  encoding: OutputEncoding,
): { text?: string; binary?: Uint8Array } {
  if (encoding === "binary") {
    return { binary: data };
  }
  if (encoding === "hex") {
    return { text: encodeHex(data) };
  }
  if (encoding === "base64url") {
    const base64 = encodeBase64(data);
    return {
      text: base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, ""),
    };
  }
  return { text: encodeBase64(data) };
}

// ============================================================================
// JSON/YAML Validation
// ============================================================================

export function validateJsonForBencode(
  input: string,
): { isValid: true; parsed: unknown } | { isValid: false; error: string } {
  try {
    const parsed = JSON.parse(input);
    return { isValid: true, parsed };
  } catch (e) {
    return {
      isValid: false,
      error: e instanceof Error ? e.message : "Invalid JSON",
    };
  }
}

export function validateYamlForBencode(
  input: string,
): { isValid: true; parsed: unknown } | { isValid: false; error: string } {
  try {
    const parsed = yaml.load(input);
    return { isValid: true, parsed };
  } catch (e) {
    return {
      isValid: false,
      error: e instanceof Error ? e.message : "Invalid YAML",
    };
  }
}

export function objectToJson(obj: unknown): string {
  return JSON.stringify(obj, replacer, 2);
}

export function objectToYaml(obj: unknown): string {
  return yaml.dump(obj, { indent: 2, lineWidth: -1, noRefs: true });
}

function replacer(_key: string, value: unknown): unknown {
  if (value instanceof Uint8Array) {
    return `<binary: ${value.length} bytes>`;
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  return value;
}

// ============================================================================
// Bencode Encode/Decode
// ============================================================================

export function encodeBencode(data: unknown): Uint8Array {
  return bencode.encode(data as never);
}

export function decodeBencode(data: Uint8Array): unknown {
  const decoded = bencode.decode(data);
  return normalizeBencodeValue(decoded);
}

function normalizeBencodeValue(value: unknown): unknown {
  if (value instanceof Uint8Array) {
    return decodeUtf8OrBinary(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeBencodeValue(item));
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      result[key] = normalizeBencodeValue(val);
    }
    return result;
  }
  return value;
}

function decodeUtf8OrBinary(bytes: Uint8Array): string | Uint8Array {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return bytes;
  }
}

// ============================================================================
// Detailed Decoding with Type Information
// ============================================================================

export function decodeBencodeWithDetails(data: Uint8Array): BencodeField[] {
  try {
    const decoded = decodeBencode(data);
    return analyzeValue(decoded, "$");
  } catch (error) {
    console.error(error);
    return [];
  }
}

function analyzeValue(value: unknown, path: string): BencodeField[] {
  const fields: BencodeField[] = [];

  if (value === null) {
    fields.push({ path, type: "null", value: null });
  } else if (value === undefined) {
    fields.push({ path, type: "undefined", value: undefined });
  } else if (typeof value === "string") {
    fields.push({ path, type: "string", value });
  } else if (typeof value === "number") {
    fields.push({ path, type: "integer", value });
  } else if (typeof value === "boolean") {
    fields.push({ path, type: "boolean", value });
  } else if (value instanceof Uint8Array) {
    fields.push({
      path,
      type: "binary",
      value: `<${value.length} bytes>`,
    });
  } else if (Array.isArray(value)) {
    const children: BencodeField[] = [];
    value.forEach((item, index) => {
      children.push(...analyzeValue(item, `${path}[${index}]`));
    });
    fields.push({
      path,
      type: `list[${value.length}]`,
      value: `[${value.length} items]`,
      children,
    });
  } else if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    const children: BencodeField[] = [];
    keys.forEach((key) => {
      children.push(...analyzeValue(obj[key], `${path}.${key}`));
    });
    fields.push({
      path,
      type: `dict[${keys.length}]`,
      value: `{${keys.length} entries}`,
      children,
    });
  } else {
    fields.push({ path, type: "unknown", value: String(value) });
  }

  return fields;
}
