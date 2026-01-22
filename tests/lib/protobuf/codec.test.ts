import { describe, it, expect } from "vitest"
import {
  decodeInputData,
  encodeOutputData,
  validateJsonForProtobuf,
  validateYamlForProtobuf,
  decodeProtobufWithoutSchema,
  decodeProtobufWithDetails,
  objectToJson,
  objectToYaml,
  getWireTypeName,
  WIRE_TYPES,
  encodeWithFieldTable,
  decodeWithFieldTable,
} from "../../../lib/protobuf/codec"

describe("protobuf codec", () => {
  describe("data encoding/decoding", () => {
    it("should decode base64 input", () => {
      // "CAEC" is base64 for bytes [0x08, 0x01, 0x02]
      const base64Data = "CAEC"
      const result = decodeInputData(base64Data, "base64")
      expect(result).toEqual(new Uint8Array([0x08, 0x01, 0x02]))
    })

    it("should decode hex input", () => {
      const hexData = "080102"
      const expected = new Uint8Array([0x08, 0x01, 0x02])
      const result = decodeInputData(hexData, "hex")
      expect(result).toEqual(expected)
    })

    it("should handle hex input with spaces", () => {
      const hexData = "08 01 02"
      const expected = new Uint8Array([0x08, 0x01, 0x02])
      const result = decodeInputData(hexData, "hex")
      expect(result).toEqual(expected)
    })

    it("should handle base64url input", () => {
      // base64url with - and _ characters
      const base64urlData = "CAE-_w"
      const result = decodeInputData(base64urlData, "base64")
      // Should normalize and decode properly
      expect(result.length).toBeGreaterThan(0)
    })

    it("should encode to base64", () => {
      const data = new Uint8Array([0x08, 0x01, 0x02])
      const result = encodeOutputData(data, "base64")
      expect(result.text).toBe("CAEC")
    })

    it("should encode to base64url", () => {
      const data = new Uint8Array([0x08, 0x01, 0xfe, 0xff])
      const result = encodeOutputData(data, "base64url")
      // Should not contain + or /
      expect(result.text).not.toContain("+")
      expect(result.text).not.toContain("/")
      expect(result.text).not.toContain("=")
    })

    it("should encode to hex", () => {
      const data = new Uint8Array([0x08, 0x01, 0x02])
      const result = encodeOutputData(data, "hex")
      expect(result.text).toBe("080102")
    })

    it("should encode to binary", () => {
      const data = new Uint8Array([0x08, 0x01, 0x02])
      const result = encodeOutputData(data, "binary")
      expect(result.binary).toEqual(data)
      expect(result.text).toBeUndefined()
    })

    it("should return empty array for empty input", () => {
      const result = decodeInputData("", "base64")
      expect(result).toEqual(new Uint8Array())
    })

    it("should throw error for binary encoding", () => {
      expect(() => decodeInputData("test", "binary")).toThrow("Binary input requires file upload")
    })
  })

  describe("JSON validation", () => {
    it("should validate valid JSON object", () => {
      const json = '{"name": "test", "value": 123}'
      const result = validateJsonForProtobuf(json)
      expect(result.isValid).toBe(true)
      expect(result.parsed).toEqual({ name: "test", value: 123 })
    })

    it("should reject invalid JSON", () => {
      const json = '{"name": "test", value: 123}'
      const result = validateJsonForProtobuf(json)
      expect(result.isValid).toBe(false)
      expect(result.error).toBeDefined()
    })

    it("should reject non-object JSON", () => {
      const json = '"just a string"'
      const result = validateJsonForProtobuf(json)
      expect(result.isValid).toBe(false)
      expect(result.error).toBe("Input must be a JSON object")
    })

    it("should reject empty input", () => {
      const result = validateJsonForProtobuf("")
      expect(result.isValid).toBe(false)
      expect(result.error).toBe("Empty input")
    })

    it("should handle nested objects", () => {
      const json = '{"user": {"name": "test", "address": {"city": "NYC"}}}'
      const result = validateJsonForProtobuf(json)
      expect(result.isValid).toBe(true)
      expect(result.parsed).toEqual({
        user: { name: "test", address: { city: "NYC" } },
      })
    })
  })

  describe("YAML validation", () => {
    it("should validate valid YAML object", () => {
      const yaml = `name: test
value: 123`
      const result = validateYamlForProtobuf(yaml)
      expect(result.isValid).toBe(true)
      expect(result.parsed).toEqual({ name: "test", value: 123 })
    })

    it("should handle nested YAML", () => {
      const yaml = `user:
  name: test
  age: 25`
      const result = validateYamlForProtobuf(yaml)
      expect(result.isValid).toBe(true)
      expect(result.parsed).toEqual({ user: { name: "test", age: 25 } })
    })

    it("should handle YAML arrays", () => {
      const yaml = `items:
  - one
  - two
  - three`
      const result = validateYamlForProtobuf(yaml)
      expect(result.isValid).toBe(true)
      expect(result.parsed).toEqual({ items: ["one", "two", "three"] })
    })

    it("should reject invalid YAML", () => {
      // Using tabs mixed with spaces which is invalid YAML
      const yaml = `name:
\t- invalid: [unclosed`
      const result = validateYamlForProtobuf(yaml)
      expect(result.isValid).toBe(false)
      expect(result.error).toBeDefined()
    })

    it("should reject empty input", () => {
      const result = validateYamlForProtobuf("")
      expect(result.isValid).toBe(false)
      expect(result.error).toBe("Empty input")
    })

    it("should reject non-object YAML", () => {
      const yaml = "just a string"
      const result = validateYamlForProtobuf(yaml)
      expect(result.isValid).toBe(false)
      expect(result.error).toBe("Input must be a YAML object")
    })
  })

  describe("schema-less decoding", () => {
    it("should decode basic protobuf with varint field", () => {
      // Field 1, wire type 0 (varint), value 150 (encoded as 9601)
      // 0x08 = field 1, wire type 0
      // 0x96 0x01 = 150 as varint
      const data = new Uint8Array([0x08, 0x96, 0x01])
      const result = decodeProtobufWithoutSchema(data)
      expect(result["field_1"]).toBe(150)
    })

    it("should decode protobuf with string field", () => {
      // Field 2, wire type 2 (length-delimited), value "test"
      // 0x12 = field 2, wire type 2
      // 0x04 = length 4
      // 0x74 0x65 0x73 0x74 = "test"
      const data = new Uint8Array([0x12, 0x04, 0x74, 0x65, 0x73, 0x74])
      const result = decodeProtobufWithoutSchema(data)
      expect(result["field_2"]).toBe("test")
    })

    it("should decode protobuf with multiple fields", () => {
      // Field 1 (varint) = 1, Field 2 (string) = "test"
      const data = new Uint8Array([0x08, 0x01, 0x12, 0x04, 0x74, 0x65, 0x73, 0x74])
      const result = decodeProtobufWithoutSchema(data)
      expect(result["field_1"]).toBe(1)
      expect(result["field_2"]).toBe("test")
    })

    it("should handle repeated fields", () => {
      // Two field 1 entries with values 1 and 2
      const data = new Uint8Array([0x08, 0x01, 0x08, 0x02])
      const result = decodeProtobufWithoutSchema(data)
      expect(result["field_1"]).toEqual([1, 2])
    })

    it("should return empty object for empty data", () => {
      const result = decodeProtobufWithoutSchema(new Uint8Array())
      expect(result).toEqual({})
    })

    it("should decode fixed32 fields", () => {
      // Field 1, wire type 5 (fixed32), value 0x12345678
      // 0x0d = field 1, wire type 5
      // Little-endian: 0x78 0x56 0x34 0x12
      const data = new Uint8Array([0x0d, 0x78, 0x56, 0x34, 0x12])
      const result = decodeProtobufWithoutSchema(data)
      expect(result["field_1"]).toBe(0x12345678)
    })

    it("should decode fixed64 fields", () => {
      // Field 1, wire type 1 (fixed64)
      // 0x09 = field 1, wire type 1
      const data = new Uint8Array([0x09, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])
      const result = decodeProtobufWithoutSchema(data)
      expect(result["field_1"]).toBe("1")
    })
  })

  describe("detailed field decoding", () => {
    it("should return field details with interpretations", () => {
      // Field 1, varint = 1
      const data = new Uint8Array([0x08, 0x01])
      const fields = decodeProtobufWithDetails(data)

      expect(fields).toHaveLength(1)
      expect(fields[0].fieldNumber).toBe(1)
      expect(fields[0].wireType).toBe(WIRE_TYPES.VARINT)
      expect(fields[0].interpretations.length).toBeGreaterThan(0)

      // Should have uint64 and bool interpretations
      const types = fields[0].interpretations.map((i) => i.type)
      expect(types).toContain("uint64")
      expect(types).toContain("bool")
    })

    it("should detect embedded messages", () => {
      // Nested message: outer field 1 contains inner field 1 = 42
      // Inner: 0x08 0x2a (field 1, varint 42)
      // Outer: 0x0a 0x02 0x08 0x2a (field 1, length 2, inner message)
      const data = new Uint8Array([0x0a, 0x02, 0x08, 0x2a])
      const fields = decodeProtobufWithDetails(data)

      expect(fields).toHaveLength(1)
      expect(fields[0].wireType).toBe(WIRE_TYPES.LENGTH_DELIMITED)

      // Should detect as embedded message
      const embeddedInterp = fields[0].interpretations.find((i) => i.type === "embedded message")
      expect(embeddedInterp).toBeDefined()
      expect(fields[0].nested).toBeDefined()
      expect(fields[0].nested!.length).toBe(1)
      expect(fields[0].nested![0].fieldNumber).toBe(1)
    })

    it("should return empty array for empty data", () => {
      const fields = decodeProtobufWithDetails(new Uint8Array())
      expect(fields).toEqual([])
    })
  })

  describe("object conversion", () => {
    it("should convert object to JSON", () => {
      const obj = { name: "test", value: 123 }
      const json = objectToJson(obj)
      expect(json).toBe('{\n  "name": "test",\n  "value": 123\n}')
    })

    it("should convert object to compact JSON", () => {
      const obj = { name: "test", value: 123 }
      const json = objectToJson(obj, false)
      expect(json).toBe('{"name":"test","value":123}')
    })

    it("should convert object to YAML", () => {
      const obj = { name: "test", value: 123 }
      const yaml = objectToYaml(obj)
      expect(yaml).toContain("name: test")
      expect(yaml).toContain("value: 123")
    })

    it("should handle nested objects in YAML", () => {
      const obj = { user: { name: "test", age: 25 } }
      const yaml = objectToYaml(obj)
      expect(yaml).toContain("user:")
      expect(yaml).toContain("name: test")
      expect(yaml).toContain("age: 25")
    })
  })

  describe("wire type names", () => {
    it("should return correct wire type names", () => {
      expect(getWireTypeName(WIRE_TYPES.VARINT)).toBe("Varint")
      expect(getWireTypeName(WIRE_TYPES.FIXED64)).toBe("64-bit")
      expect(getWireTypeName(WIRE_TYPES.LENGTH_DELIMITED)).toBe("Length-delimited")
      expect(getWireTypeName(WIRE_TYPES.FIXED32)).toBe("32-bit")
      expect(getWireTypeName(WIRE_TYPES.START_GROUP)).toBe("Start group (deprecated)")
      expect(getWireTypeName(WIRE_TYPES.END_GROUP)).toBe("End group (deprecated)")
    })

    it("should return Unknown for invalid wire types", () => {
      expect(getWireTypeName(99 as any)).toBe("Unknown")
    })
  })

  describe("field table encoding/decoding", () => {
    it("should encode data using field table", () => {
      const fields = [
        { number: 1, name: "name", type: "string", repeated: false },
        { number: 2, name: "age", type: "int32", repeated: false },
      ]
      const data = { name: "John", age: 30 }

      const encoded = encodeWithFieldTable(data, fields)
      expect(encoded.length).toBeGreaterThan(0)

      // Decode and verify
      const decoded = decodeProtobufWithoutSchema(encoded)
      expect(decoded["field_1"]).toBe("John")
      expect(decoded["field_2"]).toBe(30)
    })

    it("should encode repeated fields", () => {
      const fields = [{ number: 1, name: "tags", type: "string", repeated: true }]
      const data = { tags: ["a", "b", "c"] }

      const encoded = encodeWithFieldTable(data, fields)
      const decoded = decodeProtobufWithoutSchema(encoded)
      expect(decoded["field_1"]).toEqual(["a", "b", "c"])
    })

    it("should encode boolean fields", () => {
      const fields = [{ number: 1, name: "active", type: "bool", repeated: false }]

      const encodedTrue = encodeWithFieldTable({ active: true }, fields)
      const decodedTrue = decodeProtobufWithoutSchema(encodedTrue)
      expect(decodedTrue["field_1"]).toBe(1)

      const encodedFalse = encodeWithFieldTable({ active: false }, fields)
      const decodedFalse = decodeProtobufWithoutSchema(encodedFalse)
      expect(decodedFalse["field_1"]).toBe(0)
    })

    it("should encode fixed32 fields", () => {
      const fields = [{ number: 1, name: "value", type: "fixed32", repeated: false }]
      const data = { value: 0x12345678 }

      const encoded = encodeWithFieldTable(data, fields)
      const decoded = decodeProtobufWithoutSchema(encoded)
      expect(decoded["field_1"]).toBe(0x12345678)
    })

    it("should decode data using field table with custom names", () => {
      const fields = [
        { number: 1, name: "username", type: "string", repeated: false },
        { number: 2, name: "user_age", type: "int32", repeated: false },
      ]

      // Encode some data
      const encoded = encodeWithFieldTable({ username: "Alice", user_age: 25 }, fields)

      // Decode with field table
      const decoded = decodeWithFieldTable(encoded, fields)
      expect(decoded["username"]).toBe("Alice")
      expect(decoded["user_age"]).toBe(25)
    })

    it("should handle missing fields gracefully", () => {
      const fields = [
        { number: 1, name: "name", type: "string", repeated: false },
        { number: 2, name: "age", type: "int32", repeated: false },
      ]
      const data = { name: "Bob" } // age is missing

      const encoded = encodeWithFieldTable(data, fields)
      const decoded = decodeProtobufWithoutSchema(encoded)
      expect(decoded["field_1"]).toBe("Bob")
      expect(decoded["field_2"]).toBeUndefined()
    })

    it("should encode float and double fields", () => {
      const fields = [
        { number: 1, name: "float_val", type: "float", repeated: false },
        { number: 2, name: "double_val", type: "double", repeated: false },
      ]
      const data = { float_val: 3.14, double_val: 2.718281828 }

      const encoded = encodeWithFieldTable(data, fields)
      expect(encoded.length).toBeGreaterThan(0)

      // Verify the data can be decoded
      // Note: float is 32-bit and returns as number, double is 64-bit and returns as string for precision
      const decoded = decodeWithFieldTable(encoded, fields)
      expect(typeof decoded["float_val"]).toBe("number")
      // 64-bit values are returned as strings to preserve precision
      expect(decoded["double_val"]).toBeDefined()
    })
  })
})
