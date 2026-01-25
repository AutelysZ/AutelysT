// Text encoding utilities - supports various encoding formats
// Order: UTF-8, Base64, Base58, Base45, Base36, Base32, Hex, Binary, Hex escape, UTF-16LE/BE, UTF-32LE/BE, then iconv-lite

import { encodeBase64, decodeBase64 } from "./base64"
import { encodeBase58, decodeBase58 } from "./base58"
import { encodeBase45, decodeBase45 } from "./base45"
import { encodeBase36, decodeBase36 } from "./base36"
import { encodeBase32, decodeBase32 } from "./base32"
import { encodeHex, decodeHex } from "./hex"
import { encodeHexEscape, decodeHexEscape } from "./hex-escape"

export const PRIMARY_ENCODINGS = [
  "UTF-8",
  "Base64",
  "Base58",
  "Base45",
  "Base36",
  "Base32",
  "Hex (Base16)",
  "Binary",
  "Hex escape",
  "UTF-16LE",
  "UTF-16BE",
  "UTF-32LE",
  "UTF-32BE",
]

// All iconv-lite supported encodings (sorted lexicographically)
export const ICONV_ENCODINGS = [
  "armscii8",
  "ascii",
  "big5",
  "big5-hkscs",
  "cesu8",
  "cp1006",
  "cp1046",
  "cp1125",
  "cp1129",
  "cp1133",
  "cp1161",
  "cp1162",
  "cp1163",
  "cp437",
  "cp720",
  "cp737",
  "cp775",
  "cp808",
  "cp850",
  "cp852",
  "cp855",
  "cp856",
  "cp857",
  "cp858",
  "cp860",
  "cp861",
  "cp862",
  "cp863",
  "cp864",
  "cp865",
  "cp866",
  "cp869",
  "cp874",
  "cp922",
  "cp932",
  "cp936",
  "cp949",
  "cp950",
  "eucjp",
  "euckr",
  "gb18030",
  "gb2312",
  "gbk",
  "georgianacademy",
  "georgianps",
  "hproman8",
  "iso-2022-cn",
  "iso-2022-jp",
  "iso-2022-kr",
  "iso646cn",
  "iso646jp",
  "iso88591",
  "iso885910",
  "iso885911",
  "iso885913",
  "iso885914",
  "iso885915",
  "iso885916",
  "iso88592",
  "iso88593",
  "iso88594",
  "iso88595",
  "iso88596",
  "iso88597",
  "iso88598",
  "iso88599",
  "koi8r",
  "koi8ru",
  "koi8t",
  "koi8u",
  "kz1048",
  "latin1",
  "maccenteuro",
  "maccroatian",
  "maccyrillic",
  "macgreek",
  "machebrew",
  "maciceland",
  "macintosh",
  "macroman",
  "macromania",
  "macthai",
  "macturkish",
  "macukraine",
  "pt154",
  "rk1048",
  "shiftjis",
  "tcvn",
  "tis620",
  "viscii",
  "win1250",
  "win1251",
  "win1252",
  "win1253",
  "win1254",
  "win1255",
  "win1256",
  "win1257",
  "win1258",
]

function isBinaryEncoding(encoding: string): boolean {
  const binaryEncodings = [
    "base64",
    "base58",
    "base45",
    "base36",
    "base32",
    "hex (base16)",
    "hex",
    "binary",
    "hex escape",
  ]
  return binaryEncodings.includes(encoding.toLowerCase())
}

function needsIconvLite(encoding: string): boolean {
  const native = ["utf-8", "utf-16le", "utf-16be", "utf-32le", "utf-32be"]
  const lower = encoding.toLowerCase()
  return !native.includes(lower) && !isBinaryEncoding(lower)
}

// All encodings for the dropdown
export function getAllEncodings(): { value: string; label: string }[] {
  // First: primary encodings in specified order
  const primary = PRIMARY_ENCODINGS.map((enc) => ({
    value: enc,
    label: enc,
  }))

  // Then: all iconv-lite encodings sorted lexicographically
  const others = ICONV_ENCODINGS.map((enc) => ({
    value: enc,
    label: enc.toUpperCase(),
  }))

  return [...primary, ...others]
}

function encodeBinary(binaryStr: string): Uint8Array<ArrayBuffer> {
  // Treat each character as a raw byte (Latin-1/ISO-8859-1)
  const bytes = new Uint8Array(binaryStr.length)
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i) & 0xff
  }
  return bytes
}

function decodeBinary(bytes: Uint8Array): string {
  // Convert each byte to its character representation (Latin-1/ISO-8859-1)
  return String.fromCharCode(...bytes)
}

export function encodeText(text: string, encoding: string): Uint8Array<ArrayBuffer> {
  const lower = encoding.toLowerCase()

  // UTF-8: use native TextEncoder
  if (lower === "utf-8") {
    return new TextEncoder().encode(text) as Uint8Array<ArrayBuffer>
  }

  if (lower === "base64") {
    return decodeBase64(text)
  }
  if (lower === "base58") {
    return decodeBase58(text)
  }
  if (lower === "base45") {
    return decodeBase45(text)
  }
  if (lower === "base36") {
    return decodeBase36(text)
  }
  if (lower === "base32") {
    return decodeBase32(text)
  }
  if (lower === "hex (base16)" || lower === "hex") {
    return decodeHex(text)
  }
  if (lower === "binary") {
    return encodeBinary(text)
  }
  if (lower === "hex escape") {
    return decodeHexEscape(text)
  }

  // UTF-16LE
  if (lower === "utf-16le") {
    const buf = new ArrayBuffer(text.length * 2)
    const view = new Uint16Array(buf)
    for (let i = 0; i < text.length; i++) {
      view[i] = text.charCodeAt(i)
    }
    return new Uint8Array(buf)
  }

  // UTF-16BE
  if (lower === "utf-16be") {
    const buf = new ArrayBuffer(text.length * 2)
    const view = new DataView(buf)
    for (let i = 0; i < text.length; i++) {
      view.setUint16(i * 2, text.charCodeAt(i), false)
    }
    return new Uint8Array(buf)
  }

  // UTF-32LE
  if (lower === "utf-32le") {
    const codePoints = [...text].map((c) => c.codePointAt(0) || 0)
    const buf = new ArrayBuffer(codePoints.length * 4)
    const view = new DataView(buf)
    codePoints.forEach((cp, i) => view.setUint32(i * 4, cp, true))
    return new Uint8Array(buf)
  }

  // UTF-32BE
  if (lower === "utf-32be") {
    const codePoints = [...text].map((c) => c.codePointAt(0) || 0)
    const buf = new ArrayBuffer(codePoints.length * 4)
    const view = new DataView(buf)
    codePoints.forEach((cp, i) => view.setUint32(i * 4, cp, false))
    return new Uint8Array(buf)
  }

  // For other encodings (GBK, Big5, Shift_JIS, etc.), use iconv-lite
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const iconv = require("iconv-lite")
    const buffer = iconv.encode(text, lower)
    return buffer as Uint8Array<ArrayBuffer>
  } catch (err) {
    console.warn(`Encoding ${encoding} failed, falling back to UTF-8:`, err)
    return new TextEncoder().encode(text) as Uint8Array<ArrayBuffer>
  }
}

export function decodeText(bytes: Uint8Array, encoding: string): string {
  const lower = encoding.toLowerCase()

  // UTF-8: use native TextDecoder
  if (lower === "utf-8") {
    return new TextDecoder("utf-8").decode(bytes)
  }

  if (lower === "base64") {
    return encodeBase64(bytes)
  }
  if (lower === "base58") {
    return encodeBase58(bytes)
  }
  if (lower === "base45") {
    return encodeBase45(bytes)
  }
  if (lower === "base36") {
    return encodeBase36(bytes)
  }
  if (lower === "base32") {
    return encodeBase32(bytes)
  }
  if (lower === "hex (base16)" || lower === "hex") {
    return encodeHex(bytes)
  }
  if (lower === "binary") {
    return decodeBinary(bytes)
  }
  if (lower === "hex escape") {
    return encodeHexEscape(bytes)
  }

  // UTF-16LE: use native TextDecoder
  if (lower === "utf-16le") {
    return new TextDecoder("utf-16le").decode(bytes)
  }

  // UTF-16BE: use native TextDecoder
  if (lower === "utf-16be") {
    return new TextDecoder("utf-16be").decode(bytes)
  }

  // UTF-32LE: manual decode
  if (lower === "utf-32le") {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    let result = ""
    for (let i = 0; i < bytes.length; i += 4) {
      if (i + 4 <= bytes.length) {
        result += String.fromCodePoint(view.getUint32(i, true))
      }
    }
    return result
  }

  // UTF-32BE: manual decode
  if (lower === "utf-32be") {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    let result = ""
    for (let i = 0; i < bytes.length; i += 4) {
      if (i + 4 <= bytes.length) {
        result += String.fromCodePoint(view.getUint32(i, false))
      }
    }
    return result
  }

  // For other encodings, use iconv-lite
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const iconv = require("iconv-lite")
    const buffer = Buffer.from(bytes)
    return iconv.decode(buffer, lower)
  } catch (err) {
    console.warn(`Decoding ${encoding} failed, falling back to UTF-8:`, err)
    return new TextDecoder("utf-8").decode(bytes)
  }
}
