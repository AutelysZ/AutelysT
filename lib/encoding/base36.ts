// Base36 encoding/decoding (alphanumeric: 0-9, A-Z)

const BASE36_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
const BASE36_MAP: Record<string, number> = {}
for (let i = 0; i < BASE36_CHARSET.length; i++) {
  BASE36_MAP[BASE36_CHARSET[i]] = i
}

export interface Base36Options {
  upperCase?: boolean
}

export function encodeBase36(bytes: Uint8Array, options: Base36Options = {}): string {
  const { upperCase = true } = options
  if (bytes.length === 0) return ""

  // Convert bytes to bigint
  let num = BigInt(0)
  for (const byte of bytes) {
    num = num * BigInt(256) + BigInt(byte)
  }

  if (num === BigInt(0)) {
    const zeros = bytes.filter((b) => b === 0).length
    return "0".repeat(Math.max(1, zeros))
  }

  // Convert to base36
  let result = ""
  while (num > 0) {
    result = BASE36_CHARSET[Number(num % BigInt(36))] + result
    num = num / BigInt(36)
  }

  // Handle leading zeros
  let leadingZeros = 0
  for (const byte of bytes) {
    if (byte === 0) leadingZeros++
    else break
  }
  result = "0".repeat(leadingZeros) + result

  return upperCase ? result : result.toLowerCase()
}

export function decodeBase36(input: string): Uint8Array<ArrayBuffer> {
  const normalized = input.toUpperCase()

  // Validate input
  for (const char of normalized) {
    if (BASE36_MAP[char] === undefined) {
      throw new Error(`Invalid Base36 character: ${char}`)
    }
  }

  if (normalized.length === 0) return new Uint8Array(0)

  // Count leading zeros
  let leadingZeros = 0
  for (const char of normalized) {
    if (char === "0") leadingZeros++
    else break
  }

  // Convert from base36 to bigint
  let num = BigInt(0)
  for (const char of normalized) {
    num = num * BigInt(36) + BigInt(BASE36_MAP[char])
  }

  if (num === BigInt(0)) {
    return new Uint8Array(leadingZeros || 1).fill(0)
  }

  // Convert bigint to bytes
  const bytes: number[] = []
  while (num > 0) {
    bytes.unshift(Number(num % BigInt(256)))
    num = num / BigInt(256)
  }

  // Add leading zeros
  const result = new Uint8Array(leadingZeros + bytes.length)
  for (let i = 0; i < bytes.length; i++) {
    result[leadingZeros + i] = bytes[i]
  }

  return result
}

export function isValidBase36(input: string): boolean {
  const normalized = input.toUpperCase()
  for (const char of normalized) {
    if (BASE36_MAP[char] === undefined) return false
  }
  return true
}
