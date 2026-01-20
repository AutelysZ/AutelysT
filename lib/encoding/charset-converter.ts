// Charset converter utilities - supports converting between charsets with various encoding formats

import { encodeBase64, decodeBase64, isValidBase64 } from "./base64"
import { encodeHexEscape, decodeHexEscape, isValidHexEscape } from "./hex-escape"
import { ICONV_ENCODINGS } from "./text-encodings"

export type InputEncodingType = "raw" | "base64" | "url" | "hex-escape"
export type OutputEncodingType = "raw" | "base64" | "url" | "hex-escape"

export interface CharsetConverterOptions {
  inputEncoding: InputEncodingType
  outputEncoding: OutputEncodingType
  inputCharset: string
  outputCharset: string
  urlSafeBase64?: boolean
  base64Padding?: boolean
  hexEscapeUpperCase?: boolean
}

export interface ConversionResult {
  bytes: Uint8Array
  displayText: string
  rawBytes: Uint8Array
}

const PRIMARY_CHARSETS = [
  "UTF-8",
  "UTF-16LE",
  "UTF-16BE",
  "UTF-32LE",
  "UTF-32BE",
]

export function getAllCharsets(): { value: string; label: string }[] {
  const primary = PRIMARY_CHARSETS.map((enc) => ({
    value: enc,
    label: enc,
  }))

  const others = [...ICONV_ENCODINGS].sort().map((enc) => ({
    value: enc,
    label: enc.toUpperCase(),
  }))

  return [...primary, ...others]
}

export function isUtf8Charset(charset: string): boolean {
  return charset.toUpperCase() === "UTF-8"
}

export function canUseRawInput(charset: string): boolean {
  return isUtf8Charset(charset)
}

export function encodeUrlBytes(bytes: Uint8Array): string {
  let result = ""
  for (const byte of bytes) {
    result += "%" + byte.toString(16).padStart(2, "0").toUpperCase()
  }
  return result
}

export function encodeUrl(input: string, charset: string = "UTF-8"): string {
  const charsetLower = charset.toLowerCase()
  
  if (charsetLower === "utf-8") {
    return encodeURIComponent(input)
  }
  
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const iconv = require("iconv-lite")
    const bytes = iconv.encode(input, charsetLower)
    return encodeUrlBytes(bytes)
  } catch {
    return encodeURIComponent(input)
  }
}

export function decodeUrl(input: string, charset: string = "UTF-8"): string {
  const charsetLower = charset.toLowerCase()
  
  if (charsetLower === "utf-8") {
    try {
      return decodeURIComponent(input)
    } catch {
      throw new Error("Invalid URL-encoded input")
    }
  }
  
  try {
    // Decode %XX sequences to bytes
    const bytes: number[] = []
    const regex = /%([0-9A-Fa-f]{2})/g
    let match
    let lastIndex = 0
    
    while ((match = regex.exec(input)) !== null) {
      // Check for non-encoded content between matches
      if (match.index > lastIndex) {
        const between = input.slice(lastIndex, match.index)
        if (between.trim().length > 0) {
          throw new Error("Invalid URL-encoded input")
        }
      }
      bytes.push(parseInt(match[1], 16))
      lastIndex = match.index + match[0].length
    }
    
    // Check for trailing content
    if (lastIndex < input.length && input.slice(lastIndex).trim().length > 0) {
      throw new Error("Invalid URL-encoded input")
    }
    
    if (bytes.length === 0) {
      return ""
    }
    
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const iconv = require("iconv-lite")
    const buffer = Buffer.from(bytes)
    return iconv.decode(buffer, charsetLower)
  } catch (err) {
    if (err instanceof Error) throw err
    throw new Error("Invalid URL-encoded input")
  }
}

export function isValidUrlEncoded(input: string): boolean {
  try {
    const decoded = decodeURIComponent(input)
    return decoded !== input
  } catch {
    return false
  }
}

export function decodeToBytes(input: string, encoding: InputEncodingType, charset: string): Uint8Array {
  switch (encoding) {
    case "raw": {
      if (!isUtf8Charset(charset)) {
        throw new Error("Raw input encoding is only supported for UTF-8 charset")
      }
      return new TextEncoder().encode(input)
    }
    case "base64": {
      return decodeBase64(input)
    }
    case "url": {
      const decoded = decodeUrl(input, charset)
      return new TextEncoder().encode(decoded)
    }
    case "hex-escape": {
      return decodeHexEscape(input)
    }
    default:
      throw new Error(`Unsupported input encoding: ${encoding}`)
  }
}

export function bytesToDisplayText(bytes: Uint8Array, charset: string = "UTF-8"): string {
  const charsetLower = charset.toLowerCase()
  
  if (charsetLower === "utf-8") {
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    } catch {
      return new TextDecoder("utf-8", { fatal: false }).decode(bytes)
    }
  } else if (charsetLower === "utf-16le") {
    try {
      return new TextDecoder("utf-16le", { fatal: true }).decode(bytes)
    } catch {
      const result: string[] = []
      for (let i = 0; i + 1 < bytes.length; i += 2) {
        const charCode = bytes[i] | (bytes[i + 1] << 8)
        result.push(String.fromCharCode(charCode))
      }
      return result.join("")
    }
  } else if (charsetLower === "utf-16be") {
    try {
      return new TextDecoder("utf-16be", { fatal: true }).decode(bytes)
    } catch {
      const result: string[] = []
      for (let i = 0; i + 1 < bytes.length; i += 2) {
        const charCode = (bytes[i] << 8) | bytes[i + 1]
        result.push(String.fromCharCode(charCode))
      }
      return result.join("")
    }
  } else {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const iconv = require("iconv-lite")
      const buffer = Buffer.from(bytes)
      return iconv.decode(buffer, charsetLower)
    } catch {
      const latin1 = Array.from(bytes)
        .map((b) => String.fromCharCode(b))
        .join("")
      return latin1
    }
  }
}

export function encodeOutput(
  bytes: Uint8Array,
  encoding: OutputEncodingType,
  options: {
    urlSafeBase64?: boolean
    base64Padding?: boolean
    hexEscapeUpperCase?: boolean
    outputCharset?: string
  } = {},
): string {
  const { urlSafeBase64 = false, base64Padding = true, hexEscapeUpperCase = true, outputCharset = "UTF-8" } = options

  switch (encoding) {
    case "raw": {
      return bytesToDisplayText(bytes, outputCharset)
    }
    case "base64": {
      return encodeBase64(bytes, { urlSafe: urlSafeBase64, padding: base64Padding })
    }
    case "url": {
      const text = bytesToDisplayText(bytes, outputCharset)
      const encoded = encodeUrl(text, outputCharset)
      // If bytes contain BOM (non-UTF-8 charsets), re-encode to preserve BOM bytes
      if (outputCharset !== "UTF-8" && encoded.includes("%EF%BB%BF") === false && bytes.length > 0) {
        return encodeUrlBytes(bytes)
      }
      return encoded
    }
    case "hex-escape": {
      return encodeHexEscape(bytes, { upperCase: hexEscapeUpperCase })
    }
    default:
      throw new Error(`Unsupported output encoding: ${encoding}`)
  }
}

export function convertCharset(input: string, options: CharsetConverterOptions): ConversionResult {
  const { inputEncoding, outputEncoding, inputCharset, outputCharset } = options

  const decodedBytes = decodeToBytes(input, inputEncoding, inputCharset)

  let outputBytes: Uint8Array
  if (inputCharset.toUpperCase() === outputCharset.toUpperCase()) {
    outputBytes = decodedBytes
  } else {
    outputBytes = convertBytesCharset(decodedBytes, inputCharset, outputCharset)
  }

  const displayText = encodeOutput(outputBytes, outputEncoding, {
    hexEscapeUpperCase: options.hexEscapeUpperCase,
    urlSafeBase64: options.urlSafeBase64,
    base64Padding: options.base64Padding,
    outputCharset: outputCharset,
  })

  return {
    bytes: outputBytes,
    displayText,
    rawBytes: outputBytes,
  }
}

export function convertBytesCharset(
  bytes: Uint8Array,
  fromCharset: string,
  toCharset: string,
): Uint8Array {
  const fromLower = fromCharset.toLowerCase()
  const toLower = toCharset.toLowerCase()

  let text: string

  if (fromLower === "utf-8") {
    text = new TextDecoder("utf-8").decode(bytes)
  } else if (fromLower === "utf-16le") {
    text = new TextDecoder("utf-16le").decode(bytes)
  } else if (fromLower === "utf-16be") {
    text = new TextDecoder("utf-16be").decode(bytes)
  } else if (["utf-32le", "utf-32be"].includes(fromLower)) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    const codePoints: number[] = []
    for (let i = 0; i < bytes.length; i += 4) {
      if (i + 4 <= bytes.length) {
        codePoints.push(view.getUint32(i, fromLower === "utf-32le"))
      }
    }
    text = String.fromCodePoint(...codePoints)
  } else {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const iconv = require("iconv-lite")
      const buffer = Buffer.from(bytes)
      text = iconv.decode(buffer, fromLower)
    } catch {
      text = new TextDecoder("utf-8", { fatal: false }).decode(bytes)
    }
  }

  if (toLower === "utf-8") {
    return new TextEncoder().encode(text)
  } else if (toLower === "utf-16le") {
    const buf = new ArrayBuffer(text.length * 2)
    const view = new Uint16Array(buf)
    for (let i = 0; i < text.length; i++) {
      view[i] = text.charCodeAt(i)
    }
    return new Uint8Array(buf)
  } else if (toLower === "utf-16be") {
    const buf = new ArrayBuffer(text.length * 2)
    const view = new DataView(buf)
    for (let i = 0; i < text.length; i++) {
      view.setUint16(i * 2, text.charCodeAt(i), false)
    }
    return new Uint8Array(buf)
  } else if (["utf-32le", "utf-32be"].includes(toLower)) {
    const codePoints = [...text].map((c) => c.codePointAt(0) || 0)
    const buf = new ArrayBuffer(codePoints.length * 4)
    const view = new DataView(buf)
    codePoints.forEach((cp, i) => view.setUint32(i * 4, cp, toLower === "utf-32le"))
    return new Uint8Array(buf)
  } else {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const iconv = require("iconv-lite")
      const buffer = iconv.encode(text, toLower)
      return new Uint8Array(buffer)
    } catch {
      return new TextEncoder().encode(text)
    }
  }
}

export function getBytesForDownload(
  bytes: Uint8Array,
  outputEncoding: OutputEncodingType,
  charset: string,
  options: {
    urlSafeBase64?: boolean
    base64Padding?: boolean
    hexEscapeUpperCase?: boolean
  } = {},
): { content: string | Uint8Array; mimeType: string } {
  const { urlSafeBase64 = false, base64Padding = true, hexEscapeUpperCase = true } = options

  if (outputEncoding === "raw") {
    if (isUtf8Charset(charset)) {
      return { content: bytes, mimeType: "application/octet-stream" }
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const iconv = require("iconv-lite")
      const buffer = iconv.encode(new TextDecoder(charset.toLowerCase()).decode(bytes), charset.toLowerCase())
      return { content: new Uint8Array(buffer), mimeType: "application/octet-stream" }
    } catch {
      return { content: bytes, mimeType: "application/octet-stream" }
    }
  }

  const encoded = encodeOutput(bytes, outputEncoding, {
    urlSafeBase64,
    base64Padding,
    hexEscapeUpperCase,
  })

  return { content: encoded, mimeType: "text/plain" }
}

export function validateInput(input: string, encoding: InputEncodingType): boolean {
  switch (encoding) {
    case "raw":
      return true
    case "base64":
      return isValidBase64(input)
    case "url":
      return isValidUrlEncoded(input)
    case "hex-escape":
      return isValidHexEscape(input)
    default:
      return false
  }
}

export interface AutoDetectResult {
  charset: string
  encoding: InputEncodingType
  confidence: number
  isValid: boolean
}

const BOM_SIGNATURES: { signature: Uint8Array; charset: string }[] = [
  { signature: new Uint8Array([0xef, 0xbb, 0xbf]), charset: "UTF-8" },
  { signature: new Uint8Array([0xff, 0xfe]), charset: "UTF-16LE" },
  { signature: new Uint8Array([0xfe, 0xff]), charset: "UTF-16BE" },
  { signature: new Uint8Array([0xff, 0xfe, 0x00, 0x00]), charset: "UTF-32LE" },
  { signature: new Uint8Array([0x00, 0x00, 0xfe, 0xff]), charset: "UTF-32BE" },
]

function detectBOM(bytes: Uint8Array): { charset: string; consumed: number } | null {
  for (const { signature, charset } of BOM_SIGNATURES) {
    if (bytes.length >= signature.length) {
      let match = true
      for (let i = 0; i < signature.length; i++) {
        if (bytes[i] !== signature[i]) {
          match = false
          break
        }
      }
      if (match) {
        return { charset, consumed: signature.length }
      }
    }
  }
  return null
}

function isTextContent(bytes: Uint8Array): boolean {
  const textChars = new Set([
    0x09, 0x0a, 0x0d, 0x20,
    0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2a, 0x2b, 0x2c, 0x2d, 0x2e, 0x2f,
    0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x3b, 0x3c, 0x3d, 0x3e, 0x3f,
    0x40, 0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4a, 0x4b, 0x4c, 0x4d, 0x4e, 0x4f,
    0x50, 0x51, 0x52, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 0x5b, 0x5c, 0x5d, 0x5e, 0x5f,
    0x60, 0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x6b, 0x6c, 0x6d, 0x6e, 0x6f,
    0x70, 0x71, 0x72, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x7b, 0x7c, 0x7d, 0x7e,
    0xa0, 0xa1, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xab, 0xac, 0xad, 0xae, 0xaf,
    0xb0, 0xb1, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xbb, 0xbc, 0xbd, 0xbe, 0xbf,
    0xc0, 0xc1, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xcb, 0xcc, 0xcd, 0xce, 0xcf,
    0xd0, 0xd1, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xdb, 0xdc, 0xdd, 0xde, 0xdf,
    0xe0, 0xe1, 0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xeb, 0xec, 0xed, 0xee, 0xef,
    0xf0, 0xf1, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa, 0xfb, 0xfc, 0xfd, 0xfe, 0xff,
  ])

  let textByteCount = 0
  let totalBytes = 0
  for (const byte of bytes) {
    totalBytes++
    if (textChars.has(byte)) {
      textByteCount++
    }
  }

  return totalBytes > 0 && textByteCount / totalBytes > 0.9
}

export function autoDetectCharsetAndEncoding(input: string): AutoDetectResult {
  const bytes = new TextEncoder().encode(input)

  const bomResult = detectBOM(bytes)
  if (bomResult) {
    return {
      charset: bomResult.charset,
      encoding: "raw",
      confidence: 1.0,
      isValid: true,
    }
  }

  if (isValidBase64(input)) {
    return {
      charset: "UTF-8",
      encoding: "base64",
      confidence: 0.95,
      isValid: true,
    }
  }

  if (isValidUrlEncoded(input)) {
    return {
      charset: "UTF-8",
      encoding: "url",
      confidence: 0.95,
      isValid: true,
    }
  }

  if (isValidHexEscape(input)) {
    return {
      charset: "UTF-8",
      encoding: "hex-escape",
      confidence: 0.95,
      isValid: true,
    }
  }

  if (isTextContent(bytes)) {
    return {
      charset: "UTF-8",
      encoding: "raw",
      confidence: 0.9,
      isValid: true,
    }
  }

  return {
    charset: "UTF-8",
    encoding: "raw",
    confidence: 0.0,
    isValid: false,
  }
}

export function autoDetectFromFile(bytes: Uint8Array): AutoDetectResult {
  const bomResult = detectBOM(bytes)
  if (bomResult) {
    return {
      charset: bomResult.charset,
      encoding: "raw",
      confidence: 1.0,
      isValid: true,
    }
  }

  if (isTextContent(bytes)) {
    return {
      charset: "UTF-8",
      encoding: "raw",
      confidence: 0.9,
      isValid: true,
    }
  }

  return {
    charset: "UTF-8",
    encoding: "raw",
    confidence: 0.0,
    isValid: false,
  }
}
