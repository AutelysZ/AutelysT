// URL escape encoding/decoding (percent-encoding like %21)

export type EncodeMode = "all" | "component" | "reserved"

export interface UrlEscapeOptions {
  upperCase?: boolean
  mode?: EncodeMode
}

// RFC 3986 unreserved characters: A-Z a-z 0-9 - . _ ~
const UNRESERVED = /^[A-Za-z0-9\-._~]$/

// RFC 3986 reserved characters (gen-delims + sub-delims)
const RESERVED = new Set([":", "/", "?", "#", "[", "]", "@", "!", "$", "&", "'", "(", ")", "*", "+", ",", ";", "="])

/**
 * Encode bytes to URL percent-encoding
 * @param bytes - The bytes to encode
 * @param options - Encoding options
 * @returns Percent-encoded string
 */
export function encodeUrlEscape(bytes: Uint8Array, options: UrlEscapeOptions = {}): string {
  const { upperCase = true, mode = "all" } = options

  let result = ""
  for (const byte of bytes) {
    const char = String.fromCharCode(byte)

    // Decide whether to encode this byte
    let shouldEncode = true

    if (mode === "component") {
      // encodeURIComponent style: keep unreserved chars
      shouldEncode = !UNRESERVED.test(char)
    } else if (mode === "reserved") {
      // Keep both unreserved and reserved chars
      shouldEncode = !UNRESERVED.test(char) && !RESERVED.has(char)
    }
    // mode === "all": encode everything

    if (shouldEncode) {
      const hex = byte.toString(16).padStart(2, "0")
      result += "%" + (upperCase ? hex.toUpperCase() : hex.toLowerCase())
    } else {
      result += char
    }
  }

  return result
}

/**
 * Decode URL percent-encoded string to bytes
 * @param input - Percent-encoded string
 * @returns Decoded bytes
 */
export function decodeUrlEscape(input: string): Uint8Array<ArrayBuffer> {
  const bytes: number[] = []
  let i = 0

  while (i < input.length) {
    if (input[i] === "%" && i + 2 < input.length) {
      const hex = input.slice(i + 1, i + 3)
      if (/^[0-9a-fA-F]{2}$/.test(hex)) {
        bytes.push(Number.parseInt(hex, 16))
        i += 3
        continue
      }
    }
    // Non-encoded character - store as byte
    bytes.push(input.charCodeAt(i))
    i++
  }

  return new Uint8Array(bytes)
}

/**
 * Validate if a string is valid URL escape format
 * @param input - String to validate
 * @returns true if valid
 */
export function isValidUrlEscape(input: string): boolean {
  let i = 0
  while (i < input.length) {
    if (input[i] === "%") {
      if (i + 2 >= input.length) return false
      const hex = input.slice(i + 1, i + 3)
      if (!/^[0-9a-fA-F]{2}$/.test(hex)) return false
      i += 3
    } else {
      i++
    }
  }
  return true
}
