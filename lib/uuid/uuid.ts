import { v1 as uuidv1, v4 as uuidv4, v6 as uuidv6, v7 as uuidv7, validate, version as uuidVersion } from "uuid"

export type UUIDVersion = "v1" | "v4" | "v6" | "v7"

export interface ParsedUUID {
  uuid: string
  version: number
  variant: string
  timestamp?: string
  timestampRaw?: bigint | number
  nodeId?: string
  clockSeq?: number
}

export function generateUUIDs(version: UUIDVersion, count: number): string[] {
  const results: string[] = []
  for (let i = 0; i < count; i++) {
    switch (version) {
      case "v1":
        results.push(uuidv1())
        break
      case "v4":
        results.push(uuidv4())
        break
      case "v6":
        results.push(uuidv6())
        break
      case "v7":
        results.push(uuidv7())
        break
    }
  }
  return results
}

export function parseUUID(uuidStr: string): ParsedUUID | { error: string } {
  const trimmed = uuidStr.trim().toLowerCase()

  if (!validate(trimmed)) {
    return { error: "Invalid UUID format" }
  }

  const ver = uuidVersion(trimmed)
  const bytes = uuidToBytes(trimmed)

  // Determine variant
  const variantByte = bytes[8]
  let variant: string
  if ((variantByte & 0x80) === 0) {
    variant = "NCS (reserved)"
  } else if ((variantByte & 0xc0) === 0x80) {
    variant = "RFC 4122"
  } else if ((variantByte & 0xe0) === 0xc0) {
    variant = "Microsoft (reserved)"
  } else {
    variant = "Future (reserved)"
  }

  const result: ParsedUUID = {
    uuid: trimmed,
    version: ver,
    variant,
  }

  switch (ver) {
    case 1: {
      // Version 1: timestamp and node ID
      // Timestamp is 60 bits across time_low, time_mid, time_hi_and_version
      const timeLow = (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]
      const timeMid = (bytes[4] << 8) | bytes[5]
      const timeHi = ((bytes[6] & 0x0f) << 8) | bytes[7]

      const timestamp =
        BigInt(timeHi) * BigInt(0x100000000) * BigInt(0x10000) + BigInt(timeMid) * BigInt(0x100000000) + BigInt(timeLow)

      // UUID epoch is October 15, 1582, convert to Unix timestamp
      const uuidEpoch = BigInt("122192928000000000") // 100-ns intervals from UUID epoch to Unix epoch
      const unixNs = (timestamp - uuidEpoch) * BigInt(100)
      const unixMs = Number(unixNs / BigInt(1000000))

      result.timestampRaw = timestamp
      result.timestamp = new Date(unixMs).toISOString()

      // Clock sequence
      result.clockSeq = ((bytes[8] & 0x3f) << 8) | bytes[9]

      // Node ID (last 6 bytes)
      result.nodeId = Array.from(bytes.slice(10))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(":")
      break
    }

    case 6: {
      // Version 6: reordered timestamp (similar to v1 but with better sorting)
      const timeHigh =
        (BigInt(bytes[0]) << BigInt(24)) |
        (BigInt(bytes[1]) << BigInt(16)) |
        (BigInt(bytes[2]) << BigInt(8)) |
        BigInt(bytes[3])
      const timeMid = (BigInt(bytes[4]) << BigInt(8)) | BigInt(bytes[5])
      const timeLow = (BigInt(bytes[6] & 0x0f) << BigInt(8)) | BigInt(bytes[7])

      const timestamp = (timeHigh << BigInt(28)) | (timeMid << BigInt(12)) | timeLow

      const uuidEpoch = BigInt("122192928000000000")
      const unixNs = (timestamp - uuidEpoch) * BigInt(100)
      const unixMs = Number(unixNs / BigInt(1000000))

      result.timestampRaw = timestamp
      result.timestamp = new Date(unixMs).toISOString()

      result.clockSeq = ((bytes[8] & 0x3f) << 8) | bytes[9]
      result.nodeId = Array.from(bytes.slice(10))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(":")
      break
    }

    case 7: {
      // Version 7: Unix timestamp in milliseconds (first 48 bits)
      const timestampMs =
        (BigInt(bytes[0]) << BigInt(40)) |
        (BigInt(bytes[1]) << BigInt(32)) |
        (BigInt(bytes[2]) << BigInt(24)) |
        (BigInt(bytes[3]) << BigInt(16)) |
        (BigInt(bytes[4]) << BigInt(8)) |
        BigInt(bytes[5])

      result.timestampRaw = timestampMs
      result.timestamp = new Date(Number(timestampMs)).toISOString()
      break
    }

    case 4:
      // Version 4: random, no additional fields
      break

    case 3:
      // Version 3: MD5 hash
      result.nodeId = trimmed.replace(/-/g, "")
      break

    case 5:
      // Version 5: SHA-1 hash
      result.nodeId = trimmed.replace(/-/g, "")
      break
  }

  return result
}

function uuidToBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, "")
  const bytes = new Uint8Array(16)
  for (let i = 0; i < 16; i++) {
    bytes[i] = Number.parseInt(hex.substr(i * 2, 2), 16)
  }
  return bytes
}
