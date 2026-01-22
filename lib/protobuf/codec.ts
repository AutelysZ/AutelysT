import * as protobuf from "protobufjs"
import * as yaml from "js-yaml"
import { decodeBase64, encodeBase64 } from "../encoding/base64"
import { decodeHex, encodeHex } from "../encoding/hex"

// ============================================================================
// Types
// ============================================================================

export type ProtoMessage = {
  name: string
  fullName: string
  fields: ProtoField[]
  package?: string
}

export type ProtoField = {
  name: string
  number: number
  type: string
  label: "optional" | "required" | "repeated"
  options?: Record<string, unknown>
}

export type ProtoFile = {
  name: string
  package: string
  messages: ProtoMessage[]
  enums: ProtoEnum[]
  imports: string[]
}

export type ProtoEnum = {
  name: string
  fullName: string
  values: { name: string; number: number }[]
}

export type ProtoSchema = {
  files: ProtoFile[]
  root: protobuf.Root
}

export type DecodedProto = {
  [key: string]: unknown
}

export type EncodeInputFormat = "json" | "yaml"
export type DecodeOutputFormat = "json" | "yaml"
export type InputEncoding = "base64" | "hex" | "binary"
export type OutputEncoding = "binary" | "base64" | "base64url" | "hex"

// Wire types for protobuf
export const WIRE_TYPES = {
  VARINT: 0, // int32, int64, uint32, uint64, sint32, sint64, bool, enum
  FIXED64: 1, // fixed64, sfixed64, double
  LENGTH_DELIMITED: 2, // string, bytes, embedded messages, packed repeated fields
  START_GROUP: 3, // deprecated
  END_GROUP: 4, // deprecated
  FIXED32: 5, // fixed32, sfixed32, float
} as const

export type WireType = (typeof WIRE_TYPES)[keyof typeof WIRE_TYPES]

// Decoded field with metadata for schema-less decoding
export type DecodedField = {
  fieldNumber: number
  wireType: WireType
  rawValue: unknown
  interpretations: FieldInterpretation[]
  nested?: DecodedField[]
}

export type FieldInterpretation = {
  type: string
  value: unknown
  confidence: "high" | "medium" | "low"
}

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
    return { text: encodeHex(data, { upperCase: false }) }
  }

  if (encoding === "base64url") {
    return { text: encodeBase64(data, { urlSafe: true, padding: false }) }
  }

  return { text: encodeBase64(data, { urlSafe: false, padding: true }) }
}

// ============================================================================
// Schema Parsing
// ============================================================================

export async function parseProtoFiles(
  files: { name: string; content: string }[]
): Promise<ProtoSchema> {
  const root = new protobuf.Root()

  for (const file of files) {
    try {
      protobuf.parse(file.content, root, {
        keepCase: true,
        alternateCommentMode: true,
      } as protobuf.IParseOptions)
    } catch (error) {
      throw new Error(
        `Failed to parse ${file.name}: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  const parsedFiles: ProtoFile[] = []

  function extractMessages(type: protobuf.ReflectionObject, parentName = ""): ProtoMessage[] {
    const messages: ProtoMessage[] = []

    if (type instanceof protobuf.Namespace && type.nested) {
      for (const [name, nested] of Object.entries(type.nested)) {
        const fullName = parentName ? `${parentName}.${name}` : name

        if (nested instanceof protobuf.Type) {
          const fields = Object.values(nested.fields).map((field) => {
            let label: "optional" | "required" | "repeated" = "optional"
            if (field.repeated) {
              label = "repeated"
            } else if (field.required) {
              label = "required"
            }
            return {
              name: field.name,
              number: field.id,
              type: field.type,
              label,
              options: field.options,
            }
          })

          messages.push({
            name,
            fullName,
            fields,
            package: type instanceof protobuf.Namespace ? (type as protobuf.Namespace).fullName : undefined,
          })

          messages.push(...extractMessages(nested, fullName))
        } else if (nested instanceof protobuf.Namespace) {
          messages.push(...extractMessages(nested, fullName))
        }
      }
    }

    return messages
  }

  function extractEnums(type: protobuf.ReflectionObject, parentName = ""): ProtoEnum[] {
    const enums: ProtoEnum[] = []

    if (type instanceof protobuf.Namespace && type.nested) {
      for (const [name, nested] of Object.entries(type.nested)) {
        const fullName = parentName ? `${parentName}.${name}` : name

        if (nested instanceof protobuf.Enum) {
          enums.push({
            name,
            fullName,
            values: Object.entries(nested.values).map(([n, v]) => ({ name: n, number: v })),
          })
        } else if (nested instanceof protobuf.Namespace) {
          enums.push(...extractEnums(nested, fullName))
        }
      }
    }

    return enums
  }

  const messages = extractMessages(root)
  const enums = extractEnums(root)

  parsedFiles.push({
    name: "combined",
    package: "",
    messages,
    enums,
    imports: [],
  })

  return {
    files: parsedFiles,
    root,
  }
}

export function getAllMessages(schema: ProtoSchema): ProtoMessage[] {
  return schema.files.flatMap((file) => file.messages)
}

export function findMessage(schema: ProtoSchema, messageName: string): ProtoMessage | null {
  for (const file of schema.files) {
    const message = file.messages.find(
      (msg) => msg.name === messageName || msg.fullName === messageName
    )
    if (message) return message
  }
  return null
}

// ============================================================================
// Schema-based Encoding/Decoding
// ============================================================================

export async function decodeProtobuf(
  data: Uint8Array,
  schema: ProtoSchema,
  messageName: string
): Promise<DecodedProto> {
  const message = findMessage(schema, messageName)
  if (!message) {
    throw new Error(`Message "${messageName}" not found in schema`)
  }

  try {
    const MessageType = schema.root.lookupType(message.fullName)
    const decoded = MessageType.decode(data)
    // Convert to plain object with proper handling of longs and bytes
    return MessageType.toObject(decoded, {
      longs: String,
      bytes: String,
      defaults: false,
      arrays: true,
      objects: true,
      oneofs: true,
    })
  } catch (error) {
    throw new Error(
      `Failed to decode protobuf: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

export async function encodeProtobuf(
  data: DecodedProto,
  schema: ProtoSchema,
  messageName: string
): Promise<Uint8Array> {
  const message = findMessage(schema, messageName)
  if (!message) {
    throw new Error(`Message "${messageName}" not found in schema`)
  }

  try {
    const MessageType = schema.root.lookupType(message.fullName)
    const errMsg = MessageType.verify(data)
    if (errMsg) {
      throw new Error(`Invalid message data: ${errMsg}`)
    }
    const messageObj = MessageType.create(data)
    const encoded = MessageType.encode(messageObj).finish()
    return new Uint8Array(encoded)
  } catch (error) {
    throw new Error(
      `Failed to encode protobuf: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

// ============================================================================
// Schema-less Decoding (Advanced)
// ============================================================================

function readVarint(data: Uint8Array, offset: number): { value: number; bytesRead: number } {
  let value = 0
  let shift = 0
  let bytesRead = 0

  while (offset + bytesRead < data.length && bytesRead < 10) {
    const byte = data[offset + bytesRead]
    value |= (byte & 0x7f) << shift
    bytesRead++
    shift += 7
    if ((byte & 0x80) === 0) break
  }

  return { value, bytesRead }
}

function readVarintBigInt(data: Uint8Array, offset: number): { value: bigint; bytesRead: number } {
  let value = 0n
  let shift = 0n
  let bytesRead = 0

  while (offset + bytesRead < data.length && bytesRead < 10) {
    const byte = data[offset + bytesRead]
    value |= BigInt(byte & 0x7f) << shift
    bytesRead++
    shift += 7n
    if ((byte & 0x80) === 0) break
  }

  return { value, bytesRead }
}

function zigzagDecode(value: number): number {
  return (value >>> 1) ^ -(value & 1)
}

function zigzagDecodeBigInt(value: bigint): bigint {
  return (value >> 1n) ^ -(value & 1n)
}

function isLikelyUtf8String(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return false

  // Check for BOM or common text patterns
  let i = 0
  let validChars = 0
  let controlChars = 0

  while (i < bytes.length) {
    const byte = bytes[i]

    // ASCII printable characters (space to ~) or common whitespace
    if ((byte >= 0x20 && byte <= 0x7e) || byte === 0x09 || byte === 0x0a || byte === 0x0d) {
      validChars++
      i++
      continue
    }

    // Check for valid UTF-8 multi-byte sequences
    if (byte >= 0xc0 && byte <= 0xf4) {
      const seqLen =
        byte < 0xe0 ? 2 :
        byte < 0xf0 ? 3 : 4

      if (i + seqLen > bytes.length) return false

      // Validate continuation bytes
      for (let j = 1; j < seqLen; j++) {
        if ((bytes[i + j] & 0xc0) !== 0x80) return false
      }
      validChars++
      i += seqLen
      continue
    }

    // Control characters (except common whitespace)
    if (byte < 0x20) {
      controlChars++
      if (controlChars > bytes.length * 0.1) return false
    }

    i++
  }

  // Consider it a string if most characters are valid
  return validChars > bytes.length * 0.7
}

function tryDecodeAsNestedMessage(data: Uint8Array): DecodedField[] | null {
  try {
    const fields = decodeProtobufFieldsRaw(data)
    // Validate that we got reasonable results
    if (fields.length === 0) return null
    // Check that field numbers are reasonable (1-536870911 is valid range)
    for (const field of fields) {
      if (field.fieldNumber < 1 || field.fieldNumber > 536870911) return null
    }
    return fields
  } catch {
    return null
  }
}

function decodeProtobufFieldsRaw(data: Uint8Array): DecodedField[] {
  const fields: DecodedField[] = []
  let offset = 0

  while (offset < data.length) {
    // Read tag (field number + wire type)
    const tagResult = readVarint(data, offset)
    if (tagResult.bytesRead === 0) break

    const tag = tagResult.value
    const fieldNumber = tag >>> 3
    const wireType = (tag & 0x07) as WireType

    if (fieldNumber === 0) break

    offset += tagResult.bytesRead

    const field: DecodedField = {
      fieldNumber,
      wireType,
      rawValue: null,
      interpretations: [],
    }

    switch (wireType) {
      case WIRE_TYPES.VARINT: {
        const result = readVarintBigInt(data, offset)
        const value = result.value
        offset += result.bytesRead

        field.rawValue = value.toString()

        // Add interpretations
        const numValue = Number(value)
        if (numValue >= 0 && numValue <= Number.MAX_SAFE_INTEGER) {
          field.interpretations.push({
            type: "uint64",
            value: numValue,
            confidence: "high",
          })
        }

        // Signed interpretation
        const signed = zigzagDecodeBigInt(value)
        field.interpretations.push({
          type: "sint64 (zigzag)",
          value: signed.toString(),
          confidence: "medium",
        })

        // Boolean
        if (value === 0n || value === 1n) {
          field.interpretations.push({
            type: "bool",
            value: value === 1n,
            confidence: "medium",
          })
        }

        break
      }

      case WIRE_TYPES.FIXED64: {
        if (offset + 8 > data.length) {
          throw new Error("Unexpected end of data for fixed64")
        }
        const bytes = data.slice(offset, offset + 8)
        offset += 8

        // Little-endian uint64
        let uint64 = 0n
        for (let i = 0; i < 8; i++) {
          uint64 |= BigInt(bytes[i]) << BigInt(i * 8)
        }
        field.rawValue = uint64.toString()

        field.interpretations.push({
          type: "fixed64",
          value: uint64.toString(),
          confidence: "high",
        })

        // Double interpretation
        const view = new DataView(bytes.buffer, bytes.byteOffset, 8)
        const doubleVal = view.getFloat64(0, true)
        if (isFinite(doubleVal)) {
          field.interpretations.push({
            type: "double",
            value: doubleVal,
            confidence: "medium",
          })
        }

        // Signed fixed64
        const sfixed64 = uint64 > 0x7fffffffffffffffn ? uint64 - 0x10000000000000000n : uint64
        field.interpretations.push({
          type: "sfixed64",
          value: sfixed64.toString(),
          confidence: "low",
        })

        break
      }

      case WIRE_TYPES.LENGTH_DELIMITED: {
        const lengthResult = readVarint(data, offset)
        const length = lengthResult.value
        offset += lengthResult.bytesRead

        if (offset + length > data.length) {
          throw new Error("Unexpected end of data for length-delimited field")
        }

        const bytes = data.slice(offset, offset + length)
        offset += length

        field.rawValue = Array.from(bytes)

        // Try to interpret as string
        if (isLikelyUtf8String(bytes)) {
          try {
            const decoder = new TextDecoder("utf-8", { fatal: true })
            const str = decoder.decode(bytes)
            field.interpretations.push({
              type: "string",
              value: str,
              confidence: "high",
            })
          } catch {
            // Not valid UTF-8
          }
        }

        // Try to interpret as nested message
        const nested = tryDecodeAsNestedMessage(bytes)
        if (nested && nested.length > 0) {
          field.nested = nested
          field.interpretations.push({
            type: "embedded message",
            value: `(${nested.length} fields)`,
            confidence: "medium",
          })
        }

        // Always show bytes interpretation
        field.interpretations.push({
          type: "bytes",
          value: encodeHex(bytes, { upperCase: false }),
          confidence: "low",
        })

        break
      }

      case WIRE_TYPES.FIXED32: {
        if (offset + 4 > data.length) {
          throw new Error("Unexpected end of data for fixed32")
        }
        const bytes = data.slice(offset, offset + 4)
        offset += 4

        // Little-endian uint32
        let uint32 = 0
        for (let i = 0; i < 4; i++) {
          uint32 |= bytes[i] << (i * 8)
        }
        field.rawValue = uint32

        field.interpretations.push({
          type: "fixed32",
          value: uint32 >>> 0,
          confidence: "high",
        })

        // Float interpretation
        const view = new DataView(bytes.buffer, bytes.byteOffset, 4)
        const floatVal = view.getFloat32(0, true)
        if (isFinite(floatVal)) {
          field.interpretations.push({
            type: "float",
            value: floatVal,
            confidence: "medium",
          })
        }

        // Signed fixed32
        const sfixed32 = uint32 | 0
        field.interpretations.push({
          type: "sfixed32",
          value: sfixed32,
          confidence: "low",
        })

        break
      }

      default:
        throw new Error(`Unknown wire type: ${wireType}`)
    }

    fields.push(field)
  }

  return fields
}

// Convert decoded fields to a simple object for display
function fieldsToObject(fields: DecodedField[]): Record<string, unknown> {
  const result: Record<string, unknown[]> = {}

  for (const field of fields) {
    const key = `field_${field.fieldNumber}`

    // Pick the best interpretation
    let value: unknown
    if (field.interpretations.length > 0) {
      // Prefer high confidence string, then embedded message, then first interpretation
      const stringInterp = field.interpretations.find(
        (i) => i.type === "string" && i.confidence === "high"
      )
      const embeddedInterp = field.interpretations.find((i) => i.type === "embedded message")

      if (stringInterp) {
        value = stringInterp.value
      } else if (embeddedInterp && field.nested) {
        value = fieldsToObject(field.nested)
      } else {
        value = field.interpretations[0].value
      }
    } else {
      value = field.rawValue
    }

    // Handle repeated fields
    if (!result[key]) {
      result[key] = []
    }
    result[key].push(value)
  }

  // Unwrap single-element arrays
  const finalResult: Record<string, unknown> = {}
  for (const [key, values] of Object.entries(result)) {
    finalResult[key] = values.length === 1 ? values[0] : values
  }

  return finalResult
}

// Public schema-less decode function with enhanced output
export function decodeProtobufWithoutSchema(data: Uint8Array): DecodedProto {
  if (data.length === 0) {
    return {}
  }

  try {
    const fields = decodeProtobufFieldsRaw(data)
    return fieldsToObject(fields)
  } catch (error) {
    throw new Error(
      `Failed to decode protobuf: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

// Get detailed field information for UI display
export function decodeProtobufWithDetails(data: Uint8Array): DecodedField[] {
  if (data.length === 0) {
    return []
  }
  return decodeProtobufFieldsRaw(data)
}

// ============================================================================
// JSON/YAML Validation and Conversion
// ============================================================================

export function validateJsonForProtobuf(json: string): {
  isValid: boolean
  error?: string
  parsed?: unknown
} {
  if (!json.trim()) {
    return { isValid: false, error: "Empty input" }
  }

  try {
    const parsed = JSON.parse(json)
    if (typeof parsed !== "object" || parsed === null) {
      return { isValid: false, error: "Input must be a JSON object" }
    }
    return { isValid: true, parsed }
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export function validateYamlForProtobuf(yamlStr: string): {
  isValid: boolean
  error?: string
  parsed?: unknown
} {
  if (!yamlStr.trim()) {
    return { isValid: false, error: "Empty input" }
  }

  try {
    const parsed = yaml.load(yamlStr)
    if (typeof parsed !== "object" || parsed === null) {
      return { isValid: false, error: "Input must be a YAML object" }
    }
    return { isValid: true, parsed }
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export function objectToJson(obj: unknown, pretty = true): string {
  return JSON.stringify(obj, null, pretty ? 2 : undefined)
}

export function objectToYaml(obj: unknown): string {
  return yaml.dump(obj, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
    sortKeys: false,
  })
}

// ============================================================================
// Utility Functions
// ============================================================================

export function getWireTypeName(wireType: WireType): string {
  switch (wireType) {
    case WIRE_TYPES.VARINT:
      return "Varint"
    case WIRE_TYPES.FIXED64:
      return "64-bit"
    case WIRE_TYPES.LENGTH_DELIMITED:
      return "Length-delimited"
    case WIRE_TYPES.START_GROUP:
      return "Start group (deprecated)"
    case WIRE_TYPES.END_GROUP:
      return "End group (deprecated)"
    case WIRE_TYPES.FIXED32:
      return "32-bit"
    default:
      return "Unknown"
  }
}

export function formatFieldValue(field: DecodedField): string {
  if (field.interpretations.length > 0) {
    const best = field.interpretations[0]
    if (typeof best.value === "string") {
      return best.value.length > 100 ? best.value.substring(0, 100) + "..." : best.value
    }
    return String(best.value)
  }
  return String(field.rawValue)
}

// ============================================================================
// Field Table Based Encoding/Decoding
// ============================================================================

export type SimpleFieldDefinition = {
  number: number
  name: string
  type: string
  repeated: boolean
}

// Get wire type for a field type
function getWireTypeForFieldType(type: string): number {
  switch (type) {
    case "int32":
    case "int64":
    case "uint32":
    case "uint64":
    case "sint32":
    case "sint64":
    case "bool":
      return WIRE_TYPES.VARINT
    case "fixed64":
    case "sfixed64":
    case "double":
      return WIRE_TYPES.FIXED64
    case "fixed32":
    case "sfixed32":
    case "float":
      return WIRE_TYPES.FIXED32
    case "string":
    case "bytes":
    default:
      return WIRE_TYPES.LENGTH_DELIMITED
  }
}

// Write a varint to a buffer
function writeVarint(value: number | bigint): Uint8Array {
  const bytes: number[] = []
  let v = typeof value === "bigint" ? value : BigInt(value)

  do {
    let byte = Number(v & 0x7fn)
    v = v >> 7n
    if (v !== 0n) {
      byte |= 0x80
    }
    bytes.push(byte)
  } while (v !== 0n)

  return new Uint8Array(bytes)
}

// Write a signed varint using zigzag encoding
function writeSignedVarint(value: number | bigint): Uint8Array {
  const v = typeof value === "bigint" ? value : BigInt(value)
  // Zigzag encode: (n << 1) ^ (n >> 63)
  const encoded = (v << 1n) ^ (v >> 63n)
  return writeVarint(encoded)
}

// Encode a single field value
function encodeFieldValue(
  fieldNumber: number,
  type: string,
  value: unknown
): Uint8Array {
  const wireType = getWireTypeForFieldType(type)
  const tag = (fieldNumber << 3) | wireType
  const tagBytes = writeVarint(tag)

  let valueBytes: Uint8Array

  switch (type) {
    case "int32":
    case "int64":
    case "uint32":
    case "uint64": {
      const num = typeof value === "string" ? BigInt(value) : BigInt(value as number)
      valueBytes = writeVarint(num)
      break
    }

    case "sint32":
    case "sint64": {
      const num = typeof value === "string" ? BigInt(value) : BigInt(value as number)
      valueBytes = writeSignedVarint(num)
      break
    }

    case "bool": {
      const boolVal = value === true || value === "true" || value === 1 || value === "1"
      valueBytes = new Uint8Array([boolVal ? 1 : 0])
      break
    }

    case "fixed32":
    case "sfixed32": {
      const num = typeof value === "string" ? parseInt(value) : (value as number)
      valueBytes = new Uint8Array(4)
      const view = new DataView(valueBytes.buffer)
      if (type === "sfixed32") {
        view.setInt32(0, num, true)
      } else {
        view.setUint32(0, num >>> 0, true)
      }
      break
    }

    case "fixed64":
    case "sfixed64": {
      const num = typeof value === "string" ? BigInt(value) : BigInt(value as number)
      valueBytes = new Uint8Array(8)
      const view = new DataView(valueBytes.buffer)
      view.setBigUint64(0, BigInt.asUintN(64, num), true)
      break
    }

    case "float": {
      const num = typeof value === "string" ? parseFloat(value) : (value as number)
      valueBytes = new Uint8Array(4)
      const view = new DataView(valueBytes.buffer)
      view.setFloat32(0, num, true)
      break
    }

    case "double": {
      const num = typeof value === "string" ? parseFloat(value) : (value as number)
      valueBytes = new Uint8Array(8)
      const view = new DataView(valueBytes.buffer)
      view.setFloat64(0, num, true)
      break
    }

    case "string": {
      const str = String(value)
      const encoder = new TextEncoder()
      const strBytes = encoder.encode(str)
      const lengthBytes = writeVarint(strBytes.length)
      valueBytes = new Uint8Array(lengthBytes.length + strBytes.length)
      valueBytes.set(lengthBytes)
      valueBytes.set(strBytes, lengthBytes.length)
      break
    }

    case "bytes": {
      let bytes: Uint8Array
      if (value instanceof Uint8Array) {
        bytes = value
      } else if (Array.isArray(value)) {
        bytes = new Uint8Array(value)
      } else if (typeof value === "string") {
        // Try to decode as hex or base64
        try {
          if (/^[0-9a-fA-F\s]+$/.test(value)) {
            bytes = decodeHex(value.replace(/\s+/g, ""))
          } else {
            bytes = decodeBase64(value)
          }
        } catch {
          const encoder = new TextEncoder()
          bytes = encoder.encode(value)
        }
      } else {
        bytes = new Uint8Array()
      }
      const lengthBytes = writeVarint(bytes.length)
      valueBytes = new Uint8Array(lengthBytes.length + bytes.length)
      valueBytes.set(lengthBytes)
      valueBytes.set(bytes, lengthBytes.length)
      break
    }

    default:
      throw new Error(`Unknown field type: ${type}`)
  }

  // Combine tag and value
  const result = new Uint8Array(tagBytes.length + valueBytes.length)
  result.set(tagBytes)
  result.set(valueBytes, tagBytes.length)
  return result
}

// Encode data using field definitions (no .proto schema required)
export function encodeWithFieldTable(
  data: Record<string, unknown>,
  fields: SimpleFieldDefinition[]
): Uint8Array {
  const chunks: Uint8Array[] = []

  for (const field of fields) {
    const value = data[field.name]
    if (value === undefined || value === null) continue

    if (field.repeated && Array.isArray(value)) {
      // Encode each element separately
      for (const item of value) {
        chunks.push(encodeFieldValue(field.number, field.type, item))
      }
    } else {
      chunks.push(encodeFieldValue(field.number, field.type, value))
    }
  }

  // Calculate total length
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const result = new Uint8Array(totalLength)

  // Copy all chunks
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }

  return result
}

// Generated proto constants
export const GENERATED_PROTO_FILENAME = "generated.proto"
export const GENERATED_PROTO_PACKAGE = "generated"
export const GENERATED_PROTO_MESSAGE = "GeneratedMessage"
export const GENERATED_PROTO_FULL_MESSAGE = `${GENERATED_PROTO_PACKAGE}.${GENERATED_PROTO_MESSAGE}`

// Generate a .proto file content from decoded fields
export function generateProtoFromDecodedFields(fields: DecodedField[]): string {
  const fieldDefs: Map<number, { type: string; repeated: boolean }> = new Map()

  for (const field of fields) {
    const existing = fieldDefs.get(field.fieldNumber)
    if (existing) {
      // Mark as repeated if we see the same field number multiple times
      existing.repeated = true
      continue
    }

    // Infer type from wire type and interpretations
    let inferredType = "bytes"
    const highConfidence = field.interpretations.find((i) => i.confidence === "high")

    if (highConfidence) {
      switch (highConfidence.type) {
        case "string":
          inferredType = "string"
          break
        case "uint64":
        case "uint32":
          inferredType = field.wireType === WIRE_TYPES.VARINT ? "int64" : "fixed64"
          break
        case "fixed64":
          inferredType = "fixed64"
          break
        case "fixed32":
          inferredType = "fixed32"
          break
        case "double":
          inferredType = "double"
          break
        case "float":
          inferredType = "float"
          break
      }
    } else {
      // Fall back to wire type
      switch (field.wireType) {
        case WIRE_TYPES.VARINT:
          inferredType = "int64"
          break
        case WIRE_TYPES.FIXED64:
          inferredType = "fixed64"
          break
        case WIRE_TYPES.LENGTH_DELIMITED:
          // Check if it's likely a nested message
          if (field.nested && field.nested.length > 0) {
            inferredType = "bytes" // Will show as embedded message hint
          } else {
            inferredType = "bytes"
          }
          break
        case WIRE_TYPES.FIXED32:
          inferredType = "fixed32"
          break
      }
    }

    fieldDefs.set(field.fieldNumber, { type: inferredType, repeated: false })
  }

  // Build the proto file content
  const lines: string[] = [
    'syntax = "proto3";',
    "",
    `package ${GENERATED_PROTO_PACKAGE};`,
    "",
    `message ${GENERATED_PROTO_MESSAGE} {`,
  ]

  // Sort fields by number
  const sortedFields = Array.from(fieldDefs.entries()).sort((a, b) => a[0] - b[0])

  for (const [number, def] of sortedFields) {
    const repeated = def.repeated ? "repeated " : ""
    lines.push(`  ${repeated}${def.type} field_${number} = ${number};`)
  }

  lines.push("}")
  lines.push("")

  return lines.join("\n")
}

// Generate a .proto file content from a JavaScript object (for encoding)
export function generateProtoFromObject(obj: Record<string, unknown>): string {
  const lines: string[] = [
    'syntax = "proto3";',
    "",
    `package ${GENERATED_PROTO_PACKAGE};`,
    "",
  ]

  const nestedMessages: string[] = []
  const fields: string[] = []
  let fieldNumber = 1

  function inferType(value: unknown, fieldName: string): { type: string; repeated: boolean } {
    if (value === null || value === undefined) {
      return { type: "string", repeated: false }
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return { type: "string", repeated: true }
      }
      const elemType = inferType(value[0], fieldName)
      return { type: elemType.type, repeated: true }
    }

    if (typeof value === "string") {
      return { type: "string", repeated: false }
    }

    if (typeof value === "boolean") {
      return { type: "bool", repeated: false }
    }

    if (typeof value === "number") {
      if (Number.isInteger(value)) {
        // Use int64 for large integers, int32 for smaller ones
        if (value > 2147483647 || value < -2147483648) {
          return { type: "int64", repeated: false }
        }
        return { type: "int32", repeated: false }
      }
      return { type: "double", repeated: false }
    }

    if (typeof value === "bigint") {
      return { type: "int64", repeated: false }
    }

    if (typeof value === "object") {
      // Nested message
      const nestedName = fieldName.charAt(0).toUpperCase() + fieldName.slice(1)
      const nestedProto = generateNestedMessage(value as Record<string, unknown>, nestedName)
      nestedMessages.push(nestedProto)
      return { type: nestedName, repeated: false }
    }

    return { type: "string", repeated: false }
  }

  function generateNestedMessage(nestedObj: Record<string, unknown>, name: string): string {
    const nestedLines: string[] = [`message ${name} {`]
    let nestedFieldNumber = 1

    for (const [key, value] of Object.entries(nestedObj)) {
      const { type, repeated } = inferType(value, key)
      const repeatedPrefix = repeated ? "repeated " : ""
      nestedLines.push(`  ${repeatedPrefix}${type} ${key} = ${nestedFieldNumber};`)
      nestedFieldNumber++
    }

    nestedLines.push("}")
    return nestedLines.join("\n")
  }

  // Generate fields for the main message
  for (const [key, value] of Object.entries(obj)) {
    const { type, repeated } = inferType(value, key)
    const repeatedPrefix = repeated ? "repeated " : ""
    fields.push(`  ${repeatedPrefix}${type} ${key} = ${fieldNumber};`)
    fieldNumber++
  }

  // Add nested messages first
  for (const nested of nestedMessages) {
    lines.push(nested)
    lines.push("")
  }

  // Add main message
  lines.push(`message ${GENERATED_PROTO_MESSAGE} {`)
  lines.push(...fields)
  lines.push("}")
  lines.push("")

  return lines.join("\n")
}

// Decode data using field definitions for proper type conversion
export function decodeWithFieldTable(
  data: Uint8Array,
  fields: SimpleFieldDefinition[]
): Record<string, unknown> {
  // First decode without schema to get raw fields
  const rawFields = decodeProtobufFieldsRaw(data)

  // Create field lookup by number
  const fieldDefs = new Map(fields.map((f) => [f.number, f]))

  // Build result object
  const result: Record<string, unknown> = {}
  const repeatedValues: Record<string, unknown[]> = {}

  for (const rawField of rawFields) {
    const fieldDef = fieldDefs.get(rawField.fieldNumber)
    const fieldName = fieldDef?.name || `field_${rawField.fieldNumber}`
    const fieldType = fieldDef?.type || "bytes"
    const isRepeated = fieldDef?.repeated || false

    // Convert value based on field type
    let value: unknown

    switch (fieldType) {
      case "string": {
        const strInterp = rawField.interpretations.find((i) => i.type === "string")
        value = strInterp?.value ?? String(rawField.rawValue)
        break
      }

      case "bool": {
        const boolInterp = rawField.interpretations.find((i) => i.type === "bool")
        value = boolInterp?.value ?? (rawField.rawValue === "1" || rawField.rawValue === 1)
        break
      }

      case "int32":
      case "uint32":
      case "fixed32":
      case "sfixed32":
      case "float": {
        const numInterp = rawField.interpretations.find(
          (i) => i.type === "uint64" || i.type === "fixed32" || i.type === "float"
        )
        value = numInterp?.value ?? Number(rawField.rawValue)
        break
      }

      case "int64":
      case "uint64":
      case "fixed64":
      case "sfixed64":
      case "double": {
        const numInterp = rawField.interpretations.find(
          (i) => i.type === "uint64" || i.type === "fixed64" || i.type === "double"
        )
        // Keep as string for 64-bit values to preserve precision
        value = numInterp?.value !== undefined ? String(numInterp.value) : String(rawField.rawValue)
        break
      }

      case "sint32":
      case "sint64": {
        const sintInterp = rawField.interpretations.find((i) => i.type.includes("zigzag"))
        value = sintInterp?.value ?? rawField.rawValue
        break
      }

      case "bytes": {
        const bytesInterp = rawField.interpretations.find((i) => i.type === "bytes")
        value = bytesInterp?.value ?? rawField.rawValue
        break
      }

      default: {
        // Use best interpretation or raw value
        value = rawField.interpretations[0]?.value ?? rawField.rawValue
      }
    }

    // Handle repeated fields
    if (isRepeated) {
      if (!repeatedValues[fieldName]) {
        repeatedValues[fieldName] = []
      }
      repeatedValues[fieldName].push(value)
    } else {
      // Check if this field already exists (implicit repeated)
      if (result[fieldName] !== undefined) {
        if (!repeatedValues[fieldName]) {
          repeatedValues[fieldName] = [result[fieldName]]
        }
        repeatedValues[fieldName].push(value)
      } else {
        result[fieldName] = value
      }
    }
  }

  // Merge repeated values into result
  for (const [name, values] of Object.entries(repeatedValues)) {
    result[name] = values
  }

  return result
}
