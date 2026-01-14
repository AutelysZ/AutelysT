// Hex escape encoding/decoding (like \xff\x00)

export interface HexEscapeOptions {
  upperCase?: boolean
}

export function encodeHexEscape(bytes: Uint8Array, options: HexEscapeOptions = {}): string {
  const { upperCase = true } = options

  let result = ""
  for (const byte of bytes) {
    const hex = byte.toString(16).padStart(2, "0")
    result += "\\x" + (upperCase ? hex.toUpperCase() : hex.toLowerCase())
  }

  return result
}

export function decodeHexEscape(input: string): Uint8Array {
  // Match \xNN patterns
  const regex = /\\x([0-9a-fA-F]{2})/g
  const bytes: number[] = []

  let lastIndex = 0
  let match

  while ((match = regex.exec(input)) !== null) {
    // Check if there's unescaped content between matches
    if (match.index > lastIndex) {
      const between = input.slice(lastIndex, match.index)
      if (between.trim().length > 0) {
        throw new Error("Invalid hex escape format")
      }
    }
    bytes.push(Number.parseInt(match[1], 16))
    lastIndex = match.index + match[0].length
  }

  // Check for trailing content
  if (lastIndex < input.length && input.slice(lastIndex).trim().length > 0) {
    throw new Error("Invalid hex escape format")
  }

  return new Uint8Array(bytes)
}

export function isValidHexEscape(input: string): boolean {
  // Match the entire string as a sequence of \xNN patterns
  const normalized = input.replace(/\s/g, "")
  return /^(\\x[0-9a-fA-F]{2})*$/.test(normalized)
}
