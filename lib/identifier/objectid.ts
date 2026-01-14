import { ObjectId } from "bson"

export interface ParsedObjectId {
  objectId: string
  timestamp: string
  timestampRaw: number
  machineId: string
  processId: string
  counter: string
}

export function generateObjectIds(count: number): string[] {
  const results: string[] = []
  for (let i = 0; i < count; i++) {
    results.push(new ObjectId().toHexString())
  }
  return results
}

export function parseObjectId(oidStr: string): ParsedObjectId | { error: string } {
  const trimmed = oidStr.trim().toLowerCase()

  // ObjectId is 24 hex characters
  if (!/^[0-9a-f]{24}$/.test(trimmed)) {
    return { error: "Invalid ObjectId format (must be 24 hex characters)" }
  }

  try {
    const oid = new ObjectId(trimmed)
    const timestamp = oid.getTimestamp()

    // Parse the 12-byte structure:
    // - 4 bytes: timestamp (seconds since Unix epoch)
    // - 5 bytes: random value (machine id + process id in older versions)
    // - 3 bytes: counter
    const hex = trimmed
    const machineId = hex.slice(8, 18) // 5 bytes = 10 hex chars
    const counter = hex.slice(18, 24) // 3 bytes = 6 hex chars

    return {
      objectId: trimmed,
      timestamp: timestamp.toISOString(),
      timestampRaw: Math.floor(timestamp.getTime() / 1000),
      machineId,
      processId: machineId.slice(6, 10), // Part of the random value
      counter,
    }
  } catch {
    return { error: "Failed to parse ObjectId" }
  }
}
