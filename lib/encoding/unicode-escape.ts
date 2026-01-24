// Unicode escape encoding/decoding (like \u00a0)

export type UnicodeEscapeMode = "all" | "non-graphic-ascii" | "non-graphic-latin"

export interface UnicodeEscapeOptions {
  mode?: UnicodeEscapeMode
  upperCase?: boolean
}

// Check if character is a graphic ASCII character (printable: 0x20-0x7E)
function isGraphicAscii(codePoint: number): boolean {
  return codePoint >= 0x20 && codePoint <= 0x7e
}

// Check if character is a graphic Latin-1 character (printable ASCII + 0xA0-0xFF excluding C1 controls)
function isGraphicLatin(codePoint: number): boolean {
  // Printable ASCII: 0x20-0x7E
  if (codePoint >= 0x20 && codePoint <= 0x7e) return true
  // Latin-1 printable: 0xA0-0xFF (after C1 control codes 0x80-0x9F)
  if (codePoint >= 0xa0 && codePoint <= 0xff) return true
  return false
}

function shouldEscape(codePoint: number, mode: UnicodeEscapeMode): boolean {
  switch (mode) {
    case "all":
      return true
    case "non-graphic-ascii":
      // Escape anything that's NOT a graphic ASCII character
      return !isGraphicAscii(codePoint)
    case "non-graphic-latin":
      // Escape anything that's NOT a graphic Latin-1 character
      return !isGraphicLatin(codePoint)
    default:
      return false
  }
}

function escapeCodePoint(codePoint: number, upperCase: boolean): string {
  if (codePoint <= 0xffff) {
    // BMP character: \uXXXX
    const hex = codePoint.toString(16).padStart(4, "0")
    return "\\u" + (upperCase ? hex.toUpperCase() : hex.toLowerCase())
  } else {
    // Supplementary character: use surrogate pair or \u{XXXXX}
    // Using \u{XXXXX} format for clarity
    const hex = codePoint.toString(16)
    return "\\u{" + (upperCase ? hex.toUpperCase() : hex.toLowerCase()) + "}"
  }
}

export function encodeUnicodeEscape(text: string, options: UnicodeEscapeOptions = {}): string {
  const { mode = "all", upperCase = true } = options

  let result = ""
  for (const char of text) {
    const codePoint = char.codePointAt(0)!
    if (shouldEscape(codePoint, mode)) {
      result += escapeCodePoint(codePoint, upperCase)
    } else {
      result += char
    }
  }

  return result
}

export function decodeUnicodeEscape(input: string): string {
  // Match \uXXXX and \u{XXXXX} patterns
  // Also handle common escape sequences like \n, \r, \t
  let result = ""
  let i = 0

  while (i < input.length) {
    if (input[i] === "\\" && i + 1 < input.length) {
      const next = input[i + 1]

      if (next === "u") {
        if (input[i + 2] === "{") {
          // \u{XXXXX} format
          const endBrace = input.indexOf("}", i + 3)
          if (endBrace !== -1) {
            const hex = input.slice(i + 3, endBrace)
            if (/^[0-9a-fA-F]+$/.test(hex)) {
              const codePoint = Number.parseInt(hex, 16)
              if (codePoint <= 0x10ffff) {
                result += String.fromCodePoint(codePoint)
                i = endBrace + 1
                continue
              }
            }
          }
        } else if (i + 5 < input.length) {
          // \uXXXX format
          const hex = input.slice(i + 2, i + 6)
          if (/^[0-9a-fA-F]{4}$/.test(hex)) {
            const codePoint = Number.parseInt(hex, 16)
            result += String.fromCharCode(codePoint)
            i += 6
            continue
          }
        }
      } else if (next === "n") {
        result += "\n"
        i += 2
        continue
      } else if (next === "r") {
        result += "\r"
        i += 2
        continue
      } else if (next === "t") {
        result += "\t"
        i += 2
        continue
      } else if (next === "\\") {
        result += "\\"
        i += 2
        continue
      } else if (next === "0") {
        result += "\0"
        i += 2
        continue
      }
    }

    result += input[i]
    i++
  }

  return result
}

export function isValidUnicodeEscape(input: string): boolean {
  // Check if the input contains valid unicode escape sequences
  // Allow mixed content (text + escapes)
  try {
    decodeUnicodeEscape(input)
    return true
  } catch {
    return false
  }
}

export const UNICODE_ESCAPE_MODES: { value: UnicodeEscapeMode; label: string; description: string }[] = [
  { value: "all", label: "All Characters", description: "Escape all characters to \\uXXXX" },
  { value: "non-graphic-ascii", label: "Non-Graphic ASCII", description: "Keep only printable ASCII (0x20-0x7E), escape everything else" },
  { value: "non-graphic-latin", label: "Non-Graphic Latin", description: "Keep printable ASCII + Latin-1 (0xA0-0xFF), escape everything else" },
]
