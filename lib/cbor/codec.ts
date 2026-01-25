import { encode, decode } from "cbor-x"
import * as yaml from "js-yaml"
import { decodeBase64, encodeBase64 } from "../encoding/base64"
import { decodeHex, encodeHex } from "../encoding/hex"

// ============================================================================
// Types
// ============================================================================

export type InputEncoding = "base64" | "hex" | "binary"
export type OutputEncoding = "binary" | "base64" | "base64url" | "hex"
export type InputFormat = "json" | "yaml"
export type OutputFormat = "json" | "yaml"

// ============================================================================
// Input/Output Encoding
// ============================================================================

export function decodeInputData(data: string, encoding: InputEncoding): Uint8Array {
  if (encoding === "binary") {
    throw new Error("Binary input requires file upload")
  }

  if (!data.trim()) return new Uint8Array()

  if (encoding === "hex") {
    return decodeHex(data.replace(/\s+/g, ""))
  }

  // Handle both standard base64 and base64url
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/")
  return decodeBase64(normalized)
}

export function encodeOutputData(
  data: Uint8Array,
  encoding: OutputEncoding
): { text?: string; binary?: Uint8Array } {
  if (encoding === "binary") {
    return { binary: data }
  }
  if (encoding === "hex") {
    return { text: encodeHex(data) }
  }
  if (encoding === "base64url") {
    const base64 = encodeBase64(data)
    return { text: base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "") }
  }
  return { text: encodeBase64(data) }
}

// ============================================================================
// JSON/YAML Validation
// ============================================================================

export function validateJsonForCbor(
  input: string
): { isValid: true; parsed: unknown } | { isValid: false; error: string } {
  try {
    const parsed = JSON.parse(input)
    return { isValid: true, parsed }
  } catch (e) {
    return { isValid: false, error: e instanceof Error ? e.message : "Invalid JSON" }
  }
}

export function validateYamlForCbor(
  input: string
): { isValid: true; parsed: unknown } | { isValid: false; error: string } {
  try {
    const parsed = yaml.load(input)
    return { isValid: true, parsed }
  } catch (e) {
    return { isValid: false, error: e instanceof Error ? e.message : "Invalid YAML" }
  }
}

export function objectToJson(obj: unknown): string {
  return JSON.stringify(obj, replacer, 2)
}

export function objectToYaml(obj: unknown): string {
  return yaml.dump(obj, { indent: 2, lineWidth: -1, noRefs: true })
}

// Custom replacer to handle special values
function replacer(_key: string, value: unknown): unknown {
  if (value instanceof Uint8Array) {
    return `<binary: ${value.length} bytes>`
  }
  if (typeof value === "bigint") {
    return value.toString()
  }
  return value
}

// ============================================================================
// CBOR Encode/Decode
// ============================================================================

export function encodeCbor(data: unknown): Uint8Array<ArrayBuffer> {
  return encode(data) as Uint8Array<ArrayBuffer>
}

export function decodeCbor(data: Uint8Array): unknown {
  return decode(data)
}

// ============================================================================
// Detailed Decoding with Type Information
// ============================================================================

export type CborField = {
  path: string
  type: string
  value: unknown
  majorType: number
  children?: CborField[]
}

export function decodeCborWithDetails(data: Uint8Array): CborField[] {
  try {
    const decoded = decode(data)
    return analyzeValue(decoded, "$")
  } catch {
    return []
  }
}

function analyzeValue(value: unknown, path: string): CborField[] {
  const fields: CborField[] = []

  if (value === null) {
    fields.push({ path, type: "null", value: null, majorType: 7 })
  } else if (value === undefined) {
    fields.push({ path, type: "undefined", value: undefined, majorType: 7 })
  } else if (typeof value === "boolean") {
    fields.push({ path, type: "boolean", value, majorType: 7 })
  } else if (typeof value === "number") {
    if (Number.isInteger(value)) {
      if (value >= 0) {
        fields.push({ path, type: "unsigned integer", value, majorType: 0 })
      } else {
        fields.push({ path, type: "negative integer", value, majorType: 1 })
      }
    } else {
      fields.push({ path, type: "float", value, majorType: 7 })
    }
  } else if (typeof value === "bigint") {
    if (value >= 0) {
      fields.push({ path, type: "unsigned bigint", value: value.toString(), majorType: 0 })
    } else {
      fields.push({ path, type: "negative bigint", value: value.toString(), majorType: 1 })
    }
  } else if (typeof value === "string") {
    fields.push({ path, type: "text string", value, majorType: 3 })
  } else if (value instanceof Uint8Array) {
    fields.push({
      path,
      type: "byte string",
      value: `<${value.length} bytes>`,
      majorType: 2,
    })
  } else if (Array.isArray(value)) {
    const children: CborField[] = []
    value.forEach((item, index) => {
      children.push(...analyzeValue(item, `${path}[${index}]`))
    })
    fields.push({
      path,
      type: `array[${value.length}]`,
      value: `[${value.length} items]`,
      majorType: 4,
      children,
    })
  } else if (value instanceof Map) {
    const children: CborField[] = []
    let index = 0
    value.forEach((v, k) => {
      const keyStr = typeof k === "string" ? k : JSON.stringify(k)
      children.push(...analyzeValue(v, `${path}[${keyStr}]`))
      index++
    })
    fields.push({
      path,
      type: `map[${value.size}]`,
      value: `{${value.size} entries}`,
      majorType: 5,
      children,
    })
  } else if (typeof value === "object") {
    const obj = value as Record<string, unknown>
    const keys = Object.keys(obj)
    const children: CborField[] = []
    keys.forEach((key) => {
      children.push(...analyzeValue(obj[key], `${path}.${key}`))
    })
    fields.push({
      path,
      type: `map[${keys.length}]`,
      value: `{${keys.length} entries}`,
      majorType: 5,
      children,
    })
  } else {
    fields.push({ path, type: "unknown", value: String(value), majorType: -1 })
  }

  return fields
}

// ============================================================================
// CBOR Major Types
// ============================================================================

export const CBOR_MAJOR_TYPES: Record<number, string> = {
  0: "unsigned integer",
  1: "negative integer",
  2: "byte string",
  3: "text string",
  4: "array",
  5: "map",
  6: "tagged value",
  7: "simple/float",
}
