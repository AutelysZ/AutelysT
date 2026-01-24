// ASN.1 DER/BER Decoder

export interface ASN1Node {
  tagClass: "universal" | "application" | "context" | "private"
  constructed: boolean
  tag: number
  tagName: string
  length: number
  headerLength: number
  offset: number
  value: Uint8Array
  children?: ASN1Node[]
  // Decoded value for display
  decodedValue?: string
}

// Universal tag names
const UNIVERSAL_TAGS: Record<number, string> = {
  0x00: "END-OF-CONTENT",
  0x01: "BOOLEAN",
  0x02: "INTEGER",
  0x03: "BIT STRING",
  0x04: "OCTET STRING",
  0x05: "NULL",
  0x06: "OBJECT IDENTIFIER",
  0x07: "ObjectDescriptor",
  0x08: "EXTERNAL",
  0x09: "REAL",
  0x0a: "ENUMERATED",
  0x0b: "EMBEDDED PDV",
  0x0c: "UTF8String",
  0x0d: "RELATIVE-OID",
  0x0e: "TIME",
  0x10: "SEQUENCE",
  0x11: "SET",
  0x12: "NumericString",
  0x13: "PrintableString",
  0x14: "T61String",
  0x15: "VideotexString",
  0x16: "IA5String",
  0x17: "UTCTime",
  0x18: "GeneralizedTime",
  0x19: "GraphicString",
  0x1a: "VisibleString",
  0x1b: "GeneralString",
  0x1c: "UniversalString",
  0x1d: "CHARACTER STRING",
  0x1e: "BMPString",
  0x1f: "DATE",
  0x20: "TIME-OF-DAY",
  0x21: "DATE-TIME",
  0x22: "DURATION",
}

// Well-known OIDs
const KNOWN_OIDS: Record<string, string> = {
  "1.2.840.113549.1.1.1": "rsaEncryption",
  "1.2.840.113549.1.1.5": "sha1WithRSAEncryption",
  "1.2.840.113549.1.1.11": "sha256WithRSAEncryption",
  "1.2.840.113549.1.1.12": "sha384WithRSAEncryption",
  "1.2.840.113549.1.1.13": "sha512WithRSAEncryption",
  "1.2.840.10045.2.1": "ecPublicKey",
  "1.2.840.10045.3.1.7": "prime256v1",
  "1.2.840.10045.4.3.2": "ecdsa-with-SHA256",
  "1.2.840.10045.4.3.3": "ecdsa-with-SHA384",
  "1.2.840.10045.4.3.4": "ecdsa-with-SHA512",
  "1.3.132.0.34": "secp384r1",
  "1.3.132.0.35": "secp521r1",
  "2.5.4.3": "commonName",
  "2.5.4.6": "countryName",
  "2.5.4.7": "localityName",
  "2.5.4.8": "stateOrProvinceName",
  "2.5.4.10": "organizationName",
  "2.5.4.11": "organizationalUnitName",
  "2.5.29.14": "subjectKeyIdentifier",
  "2.5.29.15": "keyUsage",
  "2.5.29.17": "subjectAltName",
  "2.5.29.19": "basicConstraints",
  "2.5.29.31": "cRLDistributionPoints",
  "2.5.29.32": "certificatePolicies",
  "2.5.29.35": "authorityKeyIdentifier",
  "2.5.29.37": "extKeyUsage",
  "1.3.6.1.5.5.7.1.1": "authorityInfoAccess",
  "1.3.6.1.5.5.7.3.1": "serverAuth",
  "1.3.6.1.5.5.7.3.2": "clientAuth",
  "1.3.6.1.5.5.7.48.1": "OCSP",
  "1.3.6.1.5.5.7.48.2": "caIssuers",
  "1.3.6.1.4.1.311.60.2.1.2": "jurisdictionST",
  "1.3.6.1.4.1.311.60.2.1.3": "jurisdictionC",
  "2.16.840.1.101.3.4.2.1": "sha256",
  "2.16.840.1.101.3.4.2.2": "sha384",
  "2.16.840.1.101.3.4.2.3": "sha512",
}

export function decodeASN1(data: Uint8Array): ASN1Node {
  if (!data || data.length === 0) {
    throw new Error("Empty input data")
  }
  if (data.length < 2) {
    throw new Error("Data too short to be valid ASN.1")
  }
  const result = parseNode(data, 0)
  return result.node
}

function parseNode(data: Uint8Array, offset: number): { node: ASN1Node; bytesRead: number } {
  if (offset >= data.length) {
    throw new Error(`Unexpected end of data at offset ${offset}`)
  }

  const startOffset = offset

  // Parse tag
  const tagByte = data[offset++]
  const tagClass = getTagClass(tagByte)
  const constructed = (tagByte & 0x20) !== 0
  let tag = tagByte & 0x1f

  // Long form tag
  if (tag === 0x1f) {
    tag = 0
    let b: number
    do {
      if (offset >= data.length) {
        throw new Error(`Unexpected end of data while parsing tag at offset ${startOffset}`)
      }
      b = data[offset++]
      tag = (tag << 7) | (b & 0x7f)
    } while (b & 0x80)
  }

  // Parse length
  if (offset >= data.length) {
    throw new Error(`Unexpected end of data while parsing length at offset ${startOffset}`)
  }

  let length: number
  const lengthByte = data[offset++]

  if (lengthByte === 0x80) {
    // Indefinite length (BER only) - search for end-of-content
    length = -1
  } else if (lengthByte & 0x80) {
    // Long form length
    const numOctets = lengthByte & 0x7f
    if (offset + numOctets > data.length) {
      throw new Error(`Unexpected end of data while parsing length octets at offset ${startOffset}`)
    }
    length = 0
    for (let i = 0; i < numOctets; i++) {
      length = (length << 8) | data[offset++]
    }
  } else {
    // Short form length
    length = lengthByte
  }

  const headerLength = offset - startOffset

  // Handle indefinite length
  if (length === -1) {
    // Find end-of-content (00 00)
    let endOffset = offset
    while (endOffset < data.length - 1) {
      if (data[endOffset] === 0x00 && data[endOffset + 1] === 0x00) {
        break
      }
      endOffset++
    }
    length = endOffset - offset
  }

  // Validate we have enough data
  if (offset + length > data.length) {
    throw new Error(`Content length ${length} exceeds available data at offset ${startOffset}`)
  }

  const value = data.slice(offset, offset + length)

  const node: ASN1Node = {
    tagClass,
    constructed,
    tag,
    tagName: getTagName(tagClass, tag, constructed),
    length,
    headerLength,
    offset: startOffset,
    value,
  }

  // Parse children for constructed types
  if (constructed && length > 0) {
    node.children = []
    let childOffset = 0
    while (childOffset < length) {
      const childResult = parseNode(value, childOffset)
      node.children.push(childResult.node)
      childOffset += childResult.bytesRead
    }
  }

  // Decode value for display
  node.decodedValue = decodeValue(node)

  return {
    node,
    bytesRead: headerLength + length,
  }
}

function getTagClass(tagByte: number): ASN1Node["tagClass"] {
  const cls = (tagByte >> 6) & 0x03
  switch (cls) {
    case 0:
      return "universal"
    case 1:
      return "application"
    case 2:
      return "context"
    case 3:
      return "private"
    default:
      return "universal"
  }
}

function getTagName(tagClass: ASN1Node["tagClass"], tag: number, constructed: boolean): string {
  if (tagClass === "universal") {
    return UNIVERSAL_TAGS[tag] || `UNIVERSAL ${tag}`
  } else if (tagClass === "context") {
    return `[${tag}]${constructed ? " (constructed)" : ""}`
  } else if (tagClass === "application") {
    return `[APPLICATION ${tag}]`
  } else {
    return `[PRIVATE ${tag}]`
  }
}

function decodeValue(node: ASN1Node): string {
  if (node.constructed) {
    return `(${node.children?.length || 0} elements)`
  }

  if (node.tagClass !== "universal") {
    // Try to decode as string or show hex
    const str = tryDecodeString(node.value)
    if (str) return str
    return toHexString(node.value)
  }

  switch (node.tag) {
    case 0x01: // BOOLEAN
      return node.value[0] === 0 ? "FALSE" : "TRUE"

    case 0x02: // INTEGER
      return decodeInteger(node.value)

    case 0x03: // BIT STRING
      if (node.value.length > 0) {
        const unusedBits = node.value[0]
        const bits = node.value.slice(1)
        if (bits.length <= 8) {
          return `(${unusedBits} unused) ${toHexString(bits)}`
        }
        return `(${unusedBits} unused) ${bits.length} bytes`
      }
      return "(empty)"

    case 0x04: // OCTET STRING
      // Try to decode as nested ASN.1
      if (node.value.length > 2) {
        try {
          const nested = decodeASN1(node.value)
          if (nested) {
            return `(contains ASN.1)`
          }
        } catch {
          // Not nested ASN.1
        }
      }
      if (node.value.length <= 32) {
        return toHexString(node.value)
      }
      return `${node.value.length} bytes`

    case 0x05: // NULL
      return ""

    case 0x06: // OBJECT IDENTIFIER
      return decodeOID(node.value)

    case 0x0c: // UTF8String
    case 0x12: // NumericString
    case 0x13: // PrintableString
    case 0x14: // T61String
    case 0x16: // IA5String
    case 0x19: // GraphicString
    case 0x1a: // VisibleString
    case 0x1b: // GeneralString
      return new TextDecoder("utf-8").decode(node.value)

    case 0x1e: // BMPString
      return decodeBMPString(node.value)

    case 0x1c: // UniversalString
      return decodeUniversalString(node.value)

    case 0x17: // UTCTime
      return decodeUTCTime(node.value)

    case 0x18: // GeneralizedTime
      return decodeGeneralizedTime(node.value)

    case 0x0a: // ENUMERATED
      return decodeInteger(node.value)

    default:
      if (node.value.length <= 32) {
        return toHexString(node.value)
      }
      return `${node.value.length} bytes`
  }
}

function decodeInteger(value: Uint8Array): string {
  if (value.length === 0) return "0"

  // For small integers, show decimal value
  if (value.length <= 6) {
    let num = 0n
    const isNegative = (value[0] & 0x80) !== 0

    for (const byte of value) {
      num = (num << 8n) | BigInt(byte)
    }

    if (isNegative) {
      // Two's complement
      const bits = BigInt(value.length * 8)
      num = num - (1n << bits)
    }

    return num.toString()
  }

  // For large integers, show hex
  return toHexString(value)
}

function decodeOID(value: Uint8Array): string {
  if (value.length === 0) return ""

  const components: number[] = []

  // First byte encodes first two components
  const first = value[0]
  components.push(Math.floor(first / 40))
  components.push(first % 40)

  // Remaining bytes
  let current = 0
  for (let i = 1; i < value.length; i++) {
    const byte = value[i]
    current = (current << 7) | (byte & 0x7f)
    if ((byte & 0x80) === 0) {
      components.push(current)
      current = 0
    }
  }

  const oid = components.join(".")
  const name = KNOWN_OIDS[oid]
  return name ? `${oid} (${name})` : oid
}

function decodeBMPString(value: Uint8Array): string {
  const chars: string[] = []
  for (let i = 0; i < value.length; i += 2) {
    const code = (value[i] << 8) | value[i + 1]
    chars.push(String.fromCharCode(code))
  }
  return chars.join("")
}

function decodeUniversalString(value: Uint8Array): string {
  const chars: string[] = []
  for (let i = 0; i < value.length; i += 4) {
    const code = (value[i] << 24) | (value[i + 1] << 16) | (value[i + 2] << 8) | value[i + 3]
    chars.push(String.fromCodePoint(code))
  }
  return chars.join("")
}

function decodeUTCTime(value: Uint8Array): string {
  const str = new TextDecoder().decode(value)
  // Format: YYMMDDhhmmssZ or YYMMDDhhmmss+hhmm
  const match = str.match(/^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?Z?/)
  if (match) {
    const [, yy, mm, dd, hh, min, ss] = match
    const year = parseInt(yy) >= 50 ? `19${yy}` : `20${yy}`
    return `${year}-${mm}-${dd} ${hh}:${min}:${ss || "00"} UTC`
  }
  return str
}

function decodeGeneralizedTime(value: Uint8Array): string {
  const str = new TextDecoder().decode(value)
  // Format: YYYYMMDDhhmmss.fffZ
  const match = str.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?/)
  if (match) {
    const [, yyyy, mm, dd, hh, min, ss] = match
    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss || "00"} UTC`
  }
  return str
}

function tryDecodeString(value: Uint8Array): string | null {
  try {
    const str = new TextDecoder("utf-8", { fatal: true }).decode(value)
    // Check if it's printable
    if (/^[\x20-\x7e\r\n\t]+$/.test(str)) {
      return str
    }
  } catch {
    // Not valid UTF-8
  }
  return null
}

function toHexString(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
    .join(" ")
}

// Format ASN.1 tree as text
export function formatASN1Tree(node: ASN1Node, indent: number = 0): string {
  const prefix = "  ".repeat(indent)
  const offsetStr = `[${node.offset}]`.padEnd(6)
  const lengthStr = `(${node.headerLength}+${node.length})`.padEnd(10)

  let line = `${prefix}${offsetStr} ${lengthStr} ${node.tagName}`

  if (node.decodedValue && !node.constructed) {
    // Truncate long values
    let value = node.decodedValue
    if (value.length > 60) {
      value = value.slice(0, 57) + "..."
    }
    line += `: ${value}`
  }

  const lines = [line]

  if (node.children) {
    for (const child of node.children) {
      lines.push(formatASN1Tree(child, indent + 1))
    }
  }

  return lines.join("\n")
}

// Parse PEM to DER
export function pemToDer(pem: string): Uint8Array {
  // Remove headers and whitespace
  const base64 = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s/g, "")

  // Decode base64
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

// Detect if input is PEM or hex or base64
export function parseInput(input: string): Uint8Array | null {
  const trimmed = input.trim()

  // Check for PEM format
  if (trimmed.startsWith("-----BEGIN")) {
    try {
      return pemToDer(trimmed)
    } catch {
      return null
    }
  }

  // Check for hex format (with or without spaces/colons)
  const hexClean = trimmed.replace(/[\s:]/g, "")
  if (/^[0-9a-fA-F]+$/.test(hexClean) && hexClean.length % 2 === 0) {
    const bytes = new Uint8Array(hexClean.length / 2)
    for (let i = 0; i < hexClean.length; i += 2) {
      bytes[i / 2] = parseInt(hexClean.slice(i, i + 2), 16)
    }
    return bytes
  }

  // Try base64
  try {
    const binary = atob(trimmed)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    // Validate it looks like ASN.1 (starts with valid tag)
    if (bytes.length > 0 && bytes[0] !== 0) {
      return bytes
    }
  } catch {
    // Not valid base64
  }

  return null
}
