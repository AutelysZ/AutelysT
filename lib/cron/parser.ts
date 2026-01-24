// Cron Expression Parser

export interface CronField {
  name: string
  value: string
  min: number
  max: number
  parsed: number[] | null
  description: string
  error?: string
}

export interface ParsedCron {
  expression: string
  isValid: boolean
  format: "standard" | "extended" | "unknown"
  fields: CronField[]
  description: string
  error?: string
}

// Field definitions
const FIELD_DEFS = {
  second: { name: "Second", min: 0, max: 59 },
  minute: { name: "Minute", min: 0, max: 59 },
  hour: { name: "Hour", min: 0, max: 23 },
  dayOfMonth: { name: "Day of Month", min: 1, max: 31 },
  month: { name: "Month", min: 1, max: 12 },
  dayOfWeek: { name: "Day of Week", min: 0, max: 6 },
}

// Month names
const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}

// Day names
const DAYS: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
}

// Parse a single cron field value
function parseFieldValue(value: string, min: number, max: number, names?: Record<string, number>): number[] | null {
  const result: Set<number> = new Set()

  // Handle names (JAN-DEC, SUN-SAT)
  let normalized = value.toLowerCase()
  if (names) {
    for (const [name, num] of Object.entries(names)) {
      normalized = normalized.replace(new RegExp(name, "gi"), String(num))
    }
  }

  const parts = normalized.split(",")

  for (const part of parts) {
    // Handle step values (*/5, 1-10/2)
    const [range, stepStr] = part.split("/")
    const step = stepStr ? parseInt(stepStr, 10) : 1

    if (isNaN(step) || step < 1) {
      return null
    }

    if (range === "*") {
      // All values with step
      for (let i = min; i <= max; i += step) {
        result.add(i)
      }
    } else if (range.includes("-")) {
      // Range
      const [startStr, endStr] = range.split("-")
      const start = parseInt(startStr, 10)
      const end = parseInt(endStr, 10)

      if (isNaN(start) || isNaN(end) || start < min || end > max || start > end) {
        return null
      }

      for (let i = start; i <= end; i += step) {
        result.add(i)
      }
    } else {
      // Single value
      const num = parseInt(range, 10)
      if (isNaN(num) || num < min || num > max) {
        return null
      }
      result.add(num)
    }
  }

  return Array.from(result).sort((a, b) => a - b)
}

// Describe a field value in human-readable form
function describeField(name: string, value: string, parsed: number[] | null, min: number, max: number): string {
  if (!parsed) return "invalid"

  if (value === "*") {
    return `every ${name.toLowerCase()}`
  }

  if (parsed.length === max - min + 1) {
    return `every ${name.toLowerCase()}`
  }

  if (value.startsWith("*/")) {
    const step = parseInt(value.slice(2), 10)
    return `every ${step} ${name.toLowerCase()}${step > 1 ? "s" : ""}`
  }

  if (parsed.length === 1) {
    if (name === "Month") {
      const monthNames = ["", "January", "February", "March", "April", "May", "June",
                          "July", "August", "September", "October", "November", "December"]
      return `in ${monthNames[parsed[0]]}`
    }
    if (name === "Day of Week") {
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
      return `on ${dayNames[parsed[0]]}`
    }
    return `at ${name.toLowerCase()} ${parsed[0]}`
  }

  if (name === "Day of Week") {
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    return `on ${parsed.map(d => dayNames[d]).join(", ")}`
  }

  if (name === "Month") {
    const monthNames = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    return `in ${parsed.map(m => monthNames[m]).join(", ")}`
  }

  // Check for range
  if (parsed.length > 2) {
    let isContiguous = true
    for (let i = 1; i < parsed.length; i++) {
      if (parsed[i] !== parsed[i - 1] + 1) {
        isContiguous = false
        break
      }
    }
    if (isContiguous) {
      return `${name.toLowerCase()} ${parsed[0]}-${parsed[parsed.length - 1]}`
    }
  }

  return `${name.toLowerCase()} ${parsed.join(", ")}`
}

// Parse a cron expression
export function parseCron(expression: string): ParsedCron {
  const trimmed = expression.trim()
  const parts = trimmed.split(/\s+/)

  if (parts.length < 5 || parts.length > 6) {
    return {
      expression: trimmed,
      isValid: false,
      format: "unknown",
      fields: [],
      description: "",
      error: `Invalid cron expression: expected 5 or 6 fields, got ${parts.length}`,
    }
  }

  const isExtended = parts.length === 6
  const format = isExtended ? "extended" : "standard"

  const fieldDefs = isExtended
    ? [
        { ...FIELD_DEFS.second, value: parts[0] },
        { ...FIELD_DEFS.minute, value: parts[1] },
        { ...FIELD_DEFS.hour, value: parts[2] },
        { ...FIELD_DEFS.dayOfMonth, value: parts[3] },
        { ...FIELD_DEFS.month, value: parts[4] },
        { ...FIELD_DEFS.dayOfWeek, value: parts[5] },
      ]
    : [
        { ...FIELD_DEFS.minute, value: parts[0] },
        { ...FIELD_DEFS.hour, value: parts[1] },
        { ...FIELD_DEFS.dayOfMonth, value: parts[2] },
        { ...FIELD_DEFS.month, value: parts[3] },
        { ...FIELD_DEFS.dayOfWeek, value: parts[4] },
      ]

  const fields: CronField[] = []
  let isValid = true

  for (const def of fieldDefs) {
    const names = def.name === "Month" ? MONTHS : def.name === "Day of Week" ? DAYS : undefined
    const parsed = parseFieldValue(def.value, def.min, def.max, names)

    const field: CronField = {
      name: def.name,
      value: def.value,
      min: def.min,
      max: def.max,
      parsed,
      description: describeField(def.name, def.value, parsed, def.min, def.max),
    }

    if (!parsed) {
      field.error = `Invalid value "${def.value}" for ${def.name}`
      isValid = false
    }

    fields.push(field)
  }

  const description = isValid ? generateDescription(fields, isExtended) : ""

  return {
    expression: trimmed,
    isValid,
    format,
    fields,
    description,
    error: isValid ? undefined : "Invalid cron expression",
  }
}

// Generate human-readable description
function generateDescription(fields: CronField[], isExtended: boolean): string {
  const parts: string[] = []

  const getField = (name: string) => fields.find(f => f.name === name)

  const second = getField("Second")
  const minute = getField("Minute")!
  const hour = getField("Hour")!
  const dayOfMonth = getField("Day of Month")!
  const month = getField("Month")!
  const dayOfWeek = getField("Day of Week")!

  // Time part
  if (isExtended && second && second.value !== "0") {
    if (second.value === "*") {
      parts.push("Every second")
    } else if (second.value.startsWith("*/")) {
      parts.push(`Every ${second.value.slice(2)} seconds`)
    }
  }

  if (minute.value === "*" && hour.value === "*") {
    if (!isExtended || !second || second.value === "0") {
      parts.push("Every minute")
    }
  } else if (minute.value.startsWith("*/") && hour.value === "*") {
    parts.push(`Every ${minute.value.slice(2)} minutes`)
  } else if (hour.value.startsWith("*/")) {
    parts.push(`Every ${hour.value.slice(2)} hours`)
    if (minute.parsed && minute.parsed.length === 1) {
      parts.push(`at minute ${minute.parsed[0]}`)
    }
  } else if (minute.parsed && hour.parsed) {
    if (minute.parsed.length === 1 && hour.parsed.length === 1) {
      const h = hour.parsed[0]
      const m = minute.parsed[0]
      const time = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
      parts.push(`At ${time}`)
    } else if (hour.parsed.length === 1) {
      parts.push(`At ${hour.parsed[0]}:XX`)
      if (minute.value !== "*") {
        parts.push(`(minutes: ${minute.parsed!.join(", ")})`)
      }
    } else {
      parts.push(minute.description)
      parts.push(hour.description)
    }
  }

  // Day part
  const hasDayOfMonth = dayOfMonth.value !== "*"
  const hasDayOfWeek = dayOfWeek.value !== "*"

  if (hasDayOfMonth && hasDayOfWeek) {
    parts.push(`on day ${dayOfMonth.parsed!.join(", ")} and ${dayOfWeek.description}`)
  } else if (hasDayOfMonth) {
    if (dayOfMonth.parsed!.length === 1) {
      parts.push(`on day ${dayOfMonth.parsed![0]}`)
    } else {
      parts.push(`on days ${dayOfMonth.parsed!.join(", ")}`)
    }
  } else if (hasDayOfWeek) {
    parts.push(dayOfWeek.description)
  }

  // Month part
  if (month.value !== "*") {
    parts.push(month.description)
  }

  return parts.join(" ") || "Every minute"
}

// Calculate next N run times
export function getNextRuns(expression: string, count: number = 10, from?: Date): Date[] {
  const parsed = parseCron(expression)
  if (!parsed.isValid) return []

  const results: Date[] = []
  const start = from || new Date()
  let current = new Date(start)

  // Round up to next second
  current.setMilliseconds(0)
  current.setSeconds(current.getSeconds() + 1)

  const isExtended = parsed.format === "extended"
  const getField = (name: string) => parsed.fields.find(f => f.name === name)

  const second = isExtended ? getField("Second")?.parsed || [0] : [0]
  const minute = getField("Minute")!.parsed!
  const hour = getField("Hour")!.parsed!
  const dayOfMonth = getField("Day of Month")!.parsed!
  const month = getField("Month")!.parsed!
  const dayOfWeek = getField("Day of Week")!.parsed!

  const maxIterations = 100000 // Safety limit
  let iterations = 0

  while (results.length < count && iterations < maxIterations) {
    iterations++

    // Check month
    if (!month.includes(current.getMonth() + 1)) {
      // Move to next valid month
      const nextMonth = month.find(m => m > current.getMonth() + 1)
      if (nextMonth) {
        current.setMonth(nextMonth - 1, 1)
        current.setHours(0, 0, 0, 0)
      } else {
        // Next year
        current.setFullYear(current.getFullYear() + 1)
        current.setMonth(month[0] - 1, 1)
        current.setHours(0, 0, 0, 0)
      }
      continue
    }

    // Check day of month and day of week
    const dom = current.getDate()
    const dow = current.getDay()
    const domValid = dayOfMonth.includes(dom) || dayOfMonth.length === 31
    const dowValid = dayOfWeek.includes(dow) || dayOfWeek.length === 7

    // If both are specified (not *), either can match
    // If only one is specified, that one must match
    const dayOfMonthSpecified = dayOfMonth.length < 31
    const dayOfWeekSpecified = dayOfWeek.length < 7

    let dayValid = true
    if (dayOfMonthSpecified && dayOfWeekSpecified) {
      dayValid = domValid || dowValid
    } else if (dayOfMonthSpecified) {
      dayValid = domValid
    } else if (dayOfWeekSpecified) {
      dayValid = dowValid
    }

    if (!dayValid) {
      current.setDate(current.getDate() + 1)
      current.setHours(0, 0, 0, 0)
      continue
    }

    // Check hour
    if (!hour.includes(current.getHours())) {
      const nextHour = hour.find(h => h > current.getHours())
      if (nextHour !== undefined) {
        current.setHours(nextHour, 0, 0, 0)
      } else {
        // Next day
        current.setDate(current.getDate() + 1)
        current.setHours(hour[0], 0, 0, 0)
      }
      continue
    }

    // Check minute
    if (!minute.includes(current.getMinutes())) {
      const nextMinute = minute.find(m => m > current.getMinutes())
      if (nextMinute !== undefined) {
        current.setMinutes(nextMinute, 0, 0)
      } else {
        // Next hour
        current.setHours(current.getHours() + 1, minute[0], 0, 0)
      }
      continue
    }

    // Check second (for extended format)
    if (isExtended && !second.includes(current.getSeconds())) {
      const nextSecond = second.find(s => s > current.getSeconds())
      if (nextSecond !== undefined) {
        current.setSeconds(nextSecond, 0)
      } else {
        // Next minute
        current.setMinutes(current.getMinutes() + 1, second[0], 0)
      }
      continue
    }

    // Found a match
    results.push(new Date(current))

    // Move to next second/minute
    if (isExtended) {
      current.setSeconds(current.getSeconds() + 1)
    } else {
      current.setMinutes(current.getMinutes() + 1)
    }
  }

  return results
}

// Common cron presets
export const CRON_PRESETS = [
  { label: "Every minute", expression: "* * * * *" },
  { label: "Every 5 minutes", expression: "*/5 * * * *" },
  { label: "Every 15 minutes", expression: "*/15 * * * *" },
  { label: "Every 30 minutes", expression: "*/30 * * * *" },
  { label: "Every hour", expression: "0 * * * *" },
  { label: "Every 2 hours", expression: "0 */2 * * *" },
  { label: "Every day at midnight", expression: "0 0 * * *" },
  { label: "Every day at noon", expression: "0 12 * * *" },
  { label: "Every day at 6am", expression: "0 6 * * *" },
  { label: "Every Monday at 9am", expression: "0 9 * * 1" },
  { label: "Every weekday at 9am", expression: "0 9 * * 1-5" },
  { label: "Every weekend at 10am", expression: "0 10 * * 0,6" },
  { label: "First day of month at midnight", expression: "0 0 1 * *" },
  { label: "Every quarter (Jan, Apr, Jul, Oct)", expression: "0 0 1 1,4,7,10 *" },
  { label: "Every year on Jan 1st", expression: "0 0 1 1 *" },
]
