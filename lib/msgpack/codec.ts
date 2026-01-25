import { encode, decode, ExtensionCodec } from "@msgpack/msgpack";
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

export type DecodedValue = {
  type: string;
  value: unknown;
  children?: DecodedValue[];
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

  // Handle both standard base64 and base64url
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

export function validateJsonForMsgpack(
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

export function validateYamlForMsgpack(
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

// Custom replacer to handle special values
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
// MessagePack Encode/Decode
// ============================================================================

// Custom extension codec to handle various types
const extensionCodec = new ExtensionCodec();

// Register custom type handlers if needed
// extensionCodec.register({...})

export function encodeMsgpack(data: unknown): Uint8Array {
  return encode(data, { extensionCodec });
}

export function decodeMsgpack(data: Uint8Array): unknown {
  return decode(data, { extensionCodec });
}

// ============================================================================
// Detailed Decoding with Type Information
// ============================================================================

export type MsgpackField = {
  path: string;
  type: string;
  value: unknown;
  rawType: number;
  children?: MsgpackField[];
};

export function decodeMsgpackWithDetails(data: Uint8Array): MsgpackField[] {
  try {
    const decoded = decode(data, { extensionCodec });
    return analyzeValue(decoded, "$");
  } catch {
    return [];
  }
}

function analyzeValue(value: unknown, path: string): MsgpackField[] {
  const fields: MsgpackField[] = [];

  if (value === null) {
    fields.push({ path, type: "null", value: null, rawType: 0xc0 });
  } else if (value === undefined) {
    fields.push({ path, type: "undefined", value: undefined, rawType: 0xc0 });
  } else if (typeof value === "boolean") {
    fields.push({ path, type: "boolean", value, rawType: value ? 0xc3 : 0xc2 });
  } else if (typeof value === "number") {
    if (Number.isInteger(value)) {
      fields.push({ path, type: "integer", value, rawType: getIntType(value) });
    } else {
      fields.push({ path, type: "float", value, rawType: 0xcb });
    }
  } else if (typeof value === "bigint") {
    fields.push({
      path,
      type: "bigint",
      value: value.toString(),
      rawType: 0xd3,
    });
  } else if (typeof value === "string") {
    fields.push({ path, type: "string", value, rawType: 0xdb });
  } else if (value instanceof Uint8Array) {
    fields.push({
      path,
      type: "binary",
      value: `<${value.length} bytes>`,
      rawType: 0xc6,
    });
  } else if (Array.isArray(value)) {
    const children: MsgpackField[] = [];
    value.forEach((item, index) => {
      children.push(...analyzeValue(item, `${path}[${index}]`));
    });
    fields.push({
      path,
      type: `array[${value.length}]`,
      value: `[${value.length} items]`,
      rawType: 0xdd,
      children,
    });
  } else if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    const children: MsgpackField[] = [];
    keys.forEach((key) => {
      children.push(...analyzeValue(obj[key], `${path}.${key}`));
    });
    fields.push({
      path,
      type: `map[${keys.length}]`,
      value: `{${keys.length} entries}`,
      rawType: 0xdf,
      children,
    });
  } else {
    fields.push({ path, type: "unknown", value: String(value), rawType: 0 });
  }

  return fields;
}

function getIntType(value: number): number {
  if (value >= 0) {
    if (value <= 127) return 0x00; // positive fixint
    if (value <= 255) return 0xcc; // uint8
    if (value <= 65535) return 0xcd; // uint16
    if (value <= 4294967295) return 0xce; // uint32
    return 0xcf; // uint64
  } else {
    if (value >= -32) return 0xe0; // negative fixint
    if (value >= -128) return 0xd0; // int8
    if (value >= -32768) return 0xd1; // int16
    if (value >= -2147483648) return 0xd2; // int32
    return 0xd3; // int64
  }
}

// ============================================================================
// Type Information
// ============================================================================

export const MSGPACK_TYPES: Record<number, string> = {
  0x00: "positive fixint",
  0xc0: "nil",
  0xc2: "false",
  0xc3: "true",
  0xc4: "bin 8",
  0xc5: "bin 16",
  0xc6: "bin 32",
  0xc7: "ext 8",
  0xc8: "ext 16",
  0xc9: "ext 32",
  0xca: "float 32",
  0xcb: "float 64",
  0xcc: "uint 8",
  0xcd: "uint 16",
  0xce: "uint 32",
  0xcf: "uint 64",
  0xd0: "int 8",
  0xd1: "int 16",
  0xd2: "int 32",
  0xd3: "int 64",
  0xd4: "fixext 1",
  0xd5: "fixext 2",
  0xd6: "fixext 4",
  0xd7: "fixext 8",
  0xd8: "fixext 16",
  0xd9: "str 8",
  0xda: "str 16",
  0xdb: "str 32",
  0xdc: "array 16",
  0xdd: "array 32",
  0xde: "map 16",
  0xdf: "map 32",
  0xe0: "negative fixint",
};
