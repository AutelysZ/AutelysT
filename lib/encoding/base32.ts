// Base32 encoding/decoding (RFC 4648)

const BASE32_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
const BASE32_MAP: Record<string, number> = {}
for (let i = 0; i < BASE32_CHARSET.length; i++) {
  BASE32_MAP[BASE32_CHARSET[i]] = i
}

export interface Base32Options {
  upperCase?: boolean
  padding?: boolean
}

export function encodeBase32(bytes: Uint8Array, options: Base32Options = {}): string {
  const { upperCase = true, padding = true } = options
  if (bytes.length === 0) return ""

  let result = ""
  let bits = 0
  let value = 0

  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8

    while (bits >= 5) {
      bits -= 5
      result += BASE32_CHARSET[(value >> bits) & 0x1f]
    }
  }

  if (bits > 0) {
    result += BASE32_CHARSET[(value << (5 - bits)) & 0x1f]
  }

  if (padding) {
    while (result.length % 8 !== 0) {
      result += "="
    }
  }

  return upperCase ? result : result.toLowerCase()
}

export function decodeBase32(input: string): Uint8Array {
  // Remove padding and normalize
  const normalized = input.toUpperCase().replace(/=+$/, "")

  // Validate input
  for (const char of normalized) {
    if (BASE32_MAP[char] === undefined) {
      throw new Error(`Invalid Base32 character: ${char}`)
    }
  }

  if (normalized.length === 0) return new Uint8Array(0)

  const result: number[] = []
  let bits = 0
  let value = 0

  for (const char of normalized) {
    value = (value << 5) | BASE32_MAP[char]
    bits += 5

    if (bits >= 8) {
      bits -= 8
      result.push((value >> bits) & 0xff)
    }
  }

  return new Uint8Array(result)
}

export function isValidBase32(input: string): boolean {
  const normalized = input.toUpperCase().replace(/=+$/, "")
  for (const char of normalized) {
    if (BASE32_MAP[char] === undefined) return false
  }
  return true
}
