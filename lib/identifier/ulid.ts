import { ulid, decodeTime } from "ulid"

export interface ParsedULID {
  ulid: string
  timestamp: string
  timestampRaw: number
  randomness: string
}

export function generateULIDs(count: number): string[] {
  const results: string[] = []
  for (let i = 0; i < count; i++) {
    results.push(ulid())
  }
  return results
}

export function parseULID(ulidStr: string): ParsedULID | { error: string } {
  const trimmed = ulidStr.trim().toUpperCase()

  // ULID is 26 characters, Crockford's Base32
  if (!/^[0-9A-HJKMNP-TV-Z]{26}$/i.test(trimmed)) {
    return { error: "Invalid ULID format (must be 26 Crockford Base32 characters)" }
  }

  try {
    const timestampMs = decodeTime(trimmed)
    const randomness = trimmed.slice(10) // Last 16 characters are randomness

    return {
      ulid: trimmed,
      timestamp: new Date(timestampMs).toISOString(),
      timestampRaw: timestampMs,
      randomness,
    }
  } catch {
    return { error: "Failed to parse ULID" }
  }
}
