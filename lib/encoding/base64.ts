// Base64 encoding/decoding utilities

const BASE64_STANDARD = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
const BASE64_URL_SAFE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"

export interface Base64Options {
  padding?: boolean
  urlSafe?: boolean
  mimeFormat?: boolean
}

export interface DetectedBase64Options {
  hasPadding: boolean
  isUrlSafe: boolean
  hasMimeLineBreaks: boolean
}

// Detect base64 variant from input
export function detectBase64Options(input: string): DetectedBase64Options {
  const cleanInput = input.replace(/[\r\n\s]/g, "")

  return {
    hasPadding: cleanInput.includes("="),
    isUrlSafe: cleanInput.includes("-") || cleanInput.includes("_"),
    hasMimeLineBreaks: input.includes("\n") || input.includes("\r"),
  }
}

// Encode bytes to base64
export function encodeBase64(bytes: Uint8Array, options: Base64Options = {}): string {
  const { padding = true, urlSafe = false, mimeFormat = false } = options
  const alphabet = urlSafe ? BASE64_URL_SAFE : BASE64_STANDARD

  let result = ""
  let i = 0

  while (i < bytes.length) {
    const b1 = bytes[i++]
    const b2 = i < bytes.length ? bytes[i++] : 0
    const b3 = i < bytes.length ? bytes[i++] : 0

    const triplet = (b1 << 16) | (b2 << 8) | b3

    result += alphabet[(triplet >> 18) & 0x3f]
    result += alphabet[(triplet >> 12) & 0x3f]

    if (i > bytes.length + 1) {
      result += padding ? "==" : ""
    } else if (i > bytes.length) {
      result += alphabet[(triplet >> 6) & 0x3f]
      result += padding ? "=" : ""
    } else {
      result += alphabet[(triplet >> 6) & 0x3f]
      result += alphabet[triplet & 0x3f]
    }
  }

  if (mimeFormat && result.length > 0) {
    const lines: string[] = []
    for (let j = 0; j < result.length; j += 76) {
      lines.push(result.slice(j, j + 76))
    }
    return lines.join("\r\n")
  }

  return result
}

// Decode base64 to bytes
export function decodeBase64(input: string): Uint8Array {
  // Remove whitespace and detect URL-safe variant
  const cleanInput = input.replace(/[\r\n\s]/g, "")
  const isUrlSafe = cleanInput.includes("-") || cleanInput.includes("_")

  // Convert URL-safe to standard if needed
  let normalizedInput = isUrlSafe ? cleanInput.replace(/-/g, "+").replace(/_/g, "/") : cleanInput

  // Add padding if missing
  while (normalizedInput.length % 4 !== 0) {
    normalizedInput += "="
  }

  // Use built-in atob for decoding
  try {
    const binary = atob(normalizedInput)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes
  } catch {
    throw new Error("Invalid Base64 input")
  }
}

// Validate base64 string
export function isValidBase64(input: string): boolean {
  const cleanInput = input.replace(/[\r\n\s]/g, "")
  // Check for standard or URL-safe base64 characters
  const base64Regex = /^[A-Za-z0-9+/\-_]*=*$/
  return base64Regex.test(cleanInput)
}
