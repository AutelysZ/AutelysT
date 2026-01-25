// Base58 encoding/decoding (Bitcoin alphabet)

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
const BASE58_MAP: Record<string, number> = {}
for (let i = 0; i < BASE58_ALPHABET.length; i++) {
  BASE58_MAP[BASE58_ALPHABET[i]] = i
}

export function encodeBase58(bytes: Uint8Array): string {
  if (bytes.length === 0) return ""

  // Count leading zeros
  let zeros = 0
  for (const byte of bytes) {
    if (byte === 0) zeros++
    else break
  }

  // Convert to base58
  const size = Math.ceil((bytes.length * 138) / 100) + 1
  const b58 = new Uint8Array(size)
  let length = 0

  for (const byte of bytes) {
    let carry = byte
    let i = 0
    for (let j = size - 1; (carry !== 0 || i < length) && j >= 0; j--, i++) {
      carry += 256 * b58[j]
      b58[j] = carry % 58
      carry = Math.floor(carry / 58)
    }
    length = i
  }

  // Skip leading zeros in base58 result
  let it = size - length
  while (it < size && b58[it] === 0) it++

  // Build result
  let result = "1".repeat(zeros)
  for (; it < size; it++) {
    result += BASE58_ALPHABET[b58[it]]
  }

  return result
}

export function decodeBase58(input: string): Uint8Array<ArrayBuffer> {
  if (input.length === 0) return new Uint8Array(0)

  // Validate input
  for (const char of input) {
    if (BASE58_MAP[char] === undefined) {
      throw new Error(`Invalid Base58 character: ${char}`)
    }
  }

  // Count leading '1's (zeros)
  let zeros = 0
  for (const char of input) {
    if (char === "1") zeros++
    else break
  }

  // Convert from base58
  const size = Math.ceil((input.length * 733) / 1000) + 1
  const b256 = new Uint8Array(size)
  let length = 0

  for (const char of input) {
    let carry = BASE58_MAP[char]
    let i = 0
    for (let j = size - 1; (carry !== 0 || i < length) && j >= 0; j--, i++) {
      carry += 58 * b256[j]
      b256[j] = carry % 256
      carry = Math.floor(carry / 256)
    }
    length = i
  }

  // Skip leading zeros in result
  let it = size - length
  while (it < size && b256[it] === 0) it++

  // Build result with leading zeros
  const result = new Uint8Array(zeros + size - it)
  for (let i = zeros + size - it - 1; it < size; i++, it++) {
    result[i - zeros + size - it - 1 + zeros] = b256[it]
  }

  // Properly copy with leading zeros
  const final = new Uint8Array(zeros + size - (size - length))
  let idx = 0
  for (let i = 0; i < zeros; i++) final[idx++] = 0
  for (let i = size - length; i < size; i++) final[idx++] = b256[i]

  return final
}

export function isValidBase58(input: string): boolean {
  for (const char of input) {
    if (BASE58_MAP[char] === undefined) return false
  }
  return true
}
