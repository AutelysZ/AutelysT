# Protobuf Tool

A powerful Protocol Buffers encoder and decoder with smart type detection, field table support, and full YAML compatibility.

## Features

### Three Schema Modes

**1. No Schema (Smart Decode)**
- Automatic wire type detection
- Smart type inference with confidence levels
- Detects nested/embedded messages automatically
- Perfect for quick inspection of unknown protobuf data

**2. Field Table Mode**
- Visual field editor with type selection
- No need to write .proto files
- Auto-populates from decoded data
- Edit field names, numbers, and types directly
- Supports all standard protobuf types
- Toggle between encode/decode with same field definitions

**3. Proto File Mode**
- Full .proto schema file support
- Multi-file schemas with imports
- Visual message type selector
- Field preview with type information

### Decode Mode

**Input Formats:**
- Base64 (auto-detects URL-safe variants)
- Hex (with or without spaces)
- Binary file upload

**Output Formats:**
- JSON (pretty-printed)
- YAML

### Encode Mode

**Input Formats:**
- JSON
- YAML

**Output Formats:**
- Base64
- Base64URL
- Hex
- Binary download

### Swap Button

The **Swap** button allows you to:
- Toggle between Encode and Decode modes
- Swap input and output data
- Preserve field table definitions
- Quickly test round-trip encoding/decoding

## Usage

### Quick Decode (No Schema)

1. Select "Decode" mode
2. Paste Base64 or Hex encoded protobuf data
3. View decoded fields with type interpretations
4. Expand the "Decoded Fields" panel for detailed wire format analysis

### Using Field Table

1. Select "Field Table" in the Schema section
2. Add fields with: Number, Name, Type, and Repeated flag
3. For decoding: Field table helps interpret data with proper names
4. For encoding: Enter JSON/YAML matching your field names
5. Use **Swap** to toggle modes while keeping your field definitions

**Supported Field Types:**
- `string` - UTF-8 text
- `bytes` - Binary data (hex or base64 in JSON)
- `int32`, `int64` - Signed integers
- `uint32`, `uint64` - Unsigned integers
- `sint32`, `sint64` - Zigzag-encoded signed integers
- `bool` - Boolean (true/false)
- `fixed32`, `fixed64` - Fixed-width unsigned integers
- `sfixed32`, `sfixed64` - Fixed-width signed integers
- `float` - 32-bit floating point
- `double` - 64-bit floating point

### Using Proto Files

1. Select "Proto File" in the Schema section
2. Upload your .proto files or create new ones
3. Select the target message type
4. Encode or decode with full schema validation

## Examples

### Field Table Example

Define a simple message:
| Number | Name | Type | Repeated |
|--------|------|------|----------|
| 1 | username | string | ☐ |
| 2 | age | int32 | ☐ |
| 3 | emails | string | ☑ |

Input JSON:
```json
{
  "username": "alice",
  "age": 25,
  "emails": ["alice@example.com", "alice@work.com"]
}
```

### Round-Trip Testing

1. Start in **Encode** mode with a Field Table
2. Enter your JSON/YAML data
3. Click **Swap** to decode the encoded result
4. Verify the decoded output matches your input
5. Click **Swap** again to re-encode

## Wire Format Support

| Wire Type | Types |
|-----------|-------|
| 0 (Varint) | int32, int64, uint32, uint64, sint32, sint64, bool |
| 1 (64-bit) | fixed64, sfixed64, double |
| 2 (Length-delimited) | string, bytes, embedded messages, packed repeated |
| 5 (32-bit) | fixed32, sfixed32, float |

## Technical Details

- Uses `protobufjs` for .proto schema parsing
- Uses `js-yaml` for YAML parsing and generation
- All processing happens in the browser (no server required)
- Supports Protocol Buffers version 2 and 3
- Handles 64-bit integers as strings to avoid precision loss
- Field table encoding generates valid protobuf wire format
