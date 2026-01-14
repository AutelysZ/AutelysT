// Text encoding utilities with iconv-lite support and Web API fallbacks

// All supported encodings from iconv-lite, sorted lexicographically
export const ICONV_ENCODINGS = [
  "armscii8",
  "ascii",
  "base64",
  "big5",
  "big5-hkscs",
  "binary",
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
  "ucs2",
  "ucs4",
  "utf16",
  "utf16be",
  "utf16le",
  "utf32",
  "utf32be",
  "utf32le",
  "utf7",
  "utf7imap",
  "utf8",
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

// Primary encodings to show first (in specified order)
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

// All encodings for the dropdown
export function getAllEncodings(): { value: string; label: string }[] {
  const primary = PRIMARY_ENCODINGS.map((enc) => ({
    value: enc.toLowerCase().replace(/[^a-z0-9]/g, ""),
    label: enc,
  }))

  const others = ICONV_ENCODINGS.filter(
    (enc) =>
      !PRIMARY_ENCODINGS.some((p) => p.toLowerCase().replace(/[^a-z0-9]/g, "") === enc.toLowerCase()) &&
      !["base64", "binary"].includes(enc.toLowerCase()),
  ).map((enc) => ({
    value: enc.toLowerCase(),
    label: enc.toUpperCase(),
  }))

  return [...primary, ...others]
}

// Encode text to bytes using specified encoding
export function encodeText(text: string, encoding: string): Uint8Array {
  const normalizedEncoding = encoding.toLowerCase().replace(/[^a-z0-9]/g, "")

  // Handle UTF-8 with TextEncoder
  if (normalizedEncoding === "utf8") {
    return new TextEncoder().encode(text)
  }

  // Handle UTF-16LE
  if (normalizedEncoding === "utf16le") {
    const buffer = new ArrayBuffer(text.length * 2)
    const view = new Uint16Array(buffer)
    for (let i = 0; i < text.length; i++) {
      view[i] = text.charCodeAt(i)
    }
    return new Uint8Array(buffer)
  }

  // Handle UTF-16BE
  if (normalizedEncoding === "utf16be") {
    const buffer = new ArrayBuffer(text.length * 2)
    const view = new DataView(buffer)
    for (let i = 0; i < text.length; i++) {
      view.setUint16(i * 2, text.charCodeAt(i), false)
    }
    return new Uint8Array(buffer)
  }

  // Handle UTF-32LE
  if (normalizedEncoding === "utf32le") {
    const codePoints = [...text].map((char) => char.codePointAt(0) ?? 0)
    const buffer = new ArrayBuffer(codePoints.length * 4)
    const view = new DataView(buffer)
    codePoints.forEach((cp, i) => {
      view.setUint32(i * 4, cp, true)
    })
    return new Uint8Array(buffer)
  }

  // Handle UTF-32BE
  if (normalizedEncoding === "utf32be") {
    const codePoints = [...text].map((char) => char.codePointAt(0) ?? 0)
    const buffer = new ArrayBuffer(codePoints.length * 4)
    const view = new DataView(buffer)
    codePoints.forEach((cp, i) => {
      view.setUint32(i * 4, cp, false)
    })
    return new Uint8Array(buffer)
  }

  // Default to UTF-8 for unsupported encodings
  return new TextEncoder().encode(text)
}

// Decode bytes to text using specified encoding
export function decodeText(bytes: Uint8Array, encoding: string): string {
  const normalizedEncoding = encoding.toLowerCase().replace(/[^a-z0-9]/g, "")

  // Handle UTF-8 with TextDecoder
  if (normalizedEncoding === "utf8") {
    return new TextDecoder("utf-8").decode(bytes)
  }

  // Handle UTF-16LE
  if (normalizedEncoding === "utf16le") {
    return new TextDecoder("utf-16le").decode(bytes)
  }

  // Handle UTF-16BE
  if (normalizedEncoding === "utf16be") {
    return new TextDecoder("utf-16be").decode(bytes)
  }

  // Handle UTF-32LE
  if (normalizedEncoding === "utf32le") {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    let result = ""
    for (let i = 0; i < bytes.length; i += 4) {
      if (i + 4 <= bytes.length) {
        result += String.fromCodePoint(view.getUint32(i, true))
      }
    }
    return result
  }

  // Handle UTF-32BE
  if (normalizedEncoding === "utf32be") {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    let result = ""
    for (let i = 0; i < bytes.length; i += 4) {
      if (i + 4 <= bytes.length) {
        result += String.fromCodePoint(view.getUint32(i, false))
      }
    }
    return result
  }

  // Default to UTF-8
  return new TextDecoder("utf-8").decode(bytes)
}
