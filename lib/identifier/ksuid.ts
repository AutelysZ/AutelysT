import KSUID from "ksuid"

export interface ParsedKSUID {
  ksuid: string
  timestamp: string
  timestampRaw: number
  payload: string
}

export async function generateKSUIDs(count: number): Promise<string[]> {
  const results: string[] = []
  for (let i = 0; i < count; i++) {
    const id = await KSUID.random()
    results.push(id.string)
  }
  return results
}

export function parseKSUID(ksuidStr: string): ParsedKSUID | { error: string } {
  const trimmed = ksuidStr.trim()

  // KSUID is 27 characters, base62
  if (!/^[0-9A-Za-z]{27}$/.test(trimmed)) {
    return { error: "Invalid KSUID format (must be 27 base62 characters)" }
  }

  try {
    const parsed = KSUID.parse(trimmed)
    const date = parsed.date

    return {
      ksuid: trimmed,
      timestamp: date.toISOString(),
      timestampRaw: Math.floor(date.getTime() / 1000),
      payload: Buffer.from(parsed.payload).toString("hex"),
    }
  } catch {
    return { error: "Failed to parse KSUID" }
  }
}
