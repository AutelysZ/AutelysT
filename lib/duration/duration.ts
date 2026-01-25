/**
 * ISO 8601 Duration Parser and Builder
 * Format: P[n]Y[n]M[n]W[n]DT[n]H[n]M[n]S
 */

export interface DurationComponents {
  years: number
  months: number
  weeks: number
  days: number
  hours: number
  minutes: number
  seconds: number
}

export const EMPTY_DURATION: DurationComponents = {
  years: 0,
  months: 0,
  weeks: 0,
  days: 0,
  hours: 0,
  minutes: 0,
  seconds: 0,
}

/**
 * Parse an ISO 8601 duration string into components
 * Supports: P[n]Y[n]M[n]W[n]DT[n]H[n]M[n]S
 */
export function parseDuration(input: string): { components: DurationComponents; error: string | null } {
  const trimmed = input.trim()
  
  if (!trimmed) {
    return { components: { ...EMPTY_DURATION }, error: null }
  }

  // Must start with P
  if (!trimmed.startsWith("P") && !trimmed.startsWith("p")) {
    return { components: { ...EMPTY_DURATION }, error: "Duration must start with 'P'" }
  }

  const components: DurationComponents = { ...EMPTY_DURATION }
  
  // Remove the leading P
  let remaining = trimmed.substring(1)
  
  if (!remaining) {
    return { components: { ...EMPTY_DURATION }, error: "Duration cannot be just 'P'" }
  }

  // Check if we have a time component
  const tIndex = remaining.toUpperCase().indexOf("T")
  let datePart = tIndex >= 0 ? remaining.substring(0, tIndex) : remaining
  let timePart = tIndex >= 0 ? remaining.substring(tIndex + 1) : ""

  // Parse date components (Y, M, W, D)
  const dateRegex = /(\d+(?:\.\d+)?)\s*([YMWDymwd])/g
  let dateMatch
  const usedDateDesignators = new Set<string>()
  
  while ((dateMatch = dateRegex.exec(datePart)) !== null) {
    const value = parseFloat(dateMatch[1])
    const designator = dateMatch[2].toUpperCase()
    
    if (usedDateDesignators.has(designator)) {
      return { components: { ...EMPTY_DURATION }, error: `Duplicate designator '${designator}'` }
    }
    usedDateDesignators.add(designator)
    
    switch (designator) {
      case "Y":
        components.years = value
        break
      case "M":
        components.months = value
        break
      case "W":
        components.weeks = value
        break
      case "D":
        components.days = value
        break
    }
  }

  // Validate date part - check for invalid characters
  const cleanedDatePart = datePart.replace(/(\d+(?:\.\d+)?)\s*[YMWDymwd]/g, "").trim()
  if (cleanedDatePart && !/^\s*$/.test(cleanedDatePart)) {
    return { components: { ...EMPTY_DURATION }, error: `Invalid date component: '${cleanedDatePart}'` }
  }

  // Parse time components (H, M, S)
  if (timePart) {
    const timeRegex = /(\d+(?:\.\d+)?)\s*([HMShms])/g
    let timeMatch
    const usedTimeDesignators = new Set<string>()
    
    while ((timeMatch = timeRegex.exec(timePart)) !== null) {
      const value = parseFloat(timeMatch[1])
      const designator = timeMatch[2].toUpperCase()
      
      if (usedTimeDesignators.has(designator)) {
        return { components: { ...EMPTY_DURATION }, error: `Duplicate designator '${designator}'` }
      }
      usedTimeDesignators.add(designator)
      
      switch (designator) {
        case "H":
          components.hours = value
          break
        case "M":
          components.minutes = value
          break
        case "S":
          components.seconds = value
          break
      }
    }

    // Validate time part
    const cleanedTimePart = timePart.replace(/(\d+(?:\.\d+)?)\s*[HMShms]/g, "").trim()
    if (cleanedTimePart && !/^\s*$/.test(cleanedTimePart)) {
      return { components: { ...EMPTY_DURATION }, error: `Invalid time component: '${cleanedTimePart}'` }
    }
    
    if (!usedTimeDesignators.size) {
      return { components: { ...EMPTY_DURATION }, error: "Time designator 'T' present but no time components" }
    }
  }

  // Check if we have any components at all
  const hasAny = Object.values(components).some((v) => v !== 0)
  if (!hasAny && remaining !== "0D" && remaining !== "T0S") {
    // Check for P0D or PT0S which are valid zero durations
    if (!/^0[YMWD]$/i.test(remaining) && !/^T0[HMS]$/i.test(remaining)) {
      return { components: { ...EMPTY_DURATION }, error: "No valid duration components found" }
    }
  }

  return { components, error: null }
}

/**
 * Build an ISO 8601 duration string from components
 */
export function buildDuration(components: DurationComponents): string {
  const { years, months, weeks, days, hours, minutes, seconds } = components
  
  // Check if all components are zero
  const hasDate = years || months || weeks || days
  const hasTime = hours || minutes || seconds
  
  if (!hasDate && !hasTime) {
    return "P0D"
  }

  let result = "P"
  
  // Date components
  if (years) result += formatNumber(years) + "Y"
  if (months) result += formatNumber(months) + "M"
  if (weeks) result += formatNumber(weeks) + "W"
  if (days) result += formatNumber(days) + "D"
  
  // Time components
  if (hasTime) {
    result += "T"
    if (hours) result += formatNumber(hours) + "H"
    if (minutes) result += formatNumber(minutes) + "M"
    if (seconds) result += formatNumber(seconds) + "S"
  }
  
  return result
}

/**
 * Format a number, removing unnecessary trailing zeros
 */
function formatNumber(n: number): string {
  if (Number.isInteger(n)) {
    return n.toString()
  }
  // Remove trailing zeros
  return n.toFixed(6).replace(/\.?0+$/, "")
}

/**
 * Calculate total seconds (approximate, assuming 30-day months and 365-day years)
 */
export function toTotalSeconds(components: DurationComponents): number {
  const { years, months, weeks, days, hours, minutes, seconds } = components
  
  return (
    years * 365 * 24 * 60 * 60 +
    months * 30 * 24 * 60 * 60 +
    weeks * 7 * 24 * 60 * 60 +
    days * 24 * 60 * 60 +
    hours * 60 * 60 +
    minutes * 60 +
    seconds
  )
}

/**
 * Calculate total minutes
 */
export function toTotalMinutes(components: DurationComponents): number {
  return toTotalSeconds(components) / 60
}

/**
 * Calculate total hours
 */
export function toTotalHours(components: DurationComponents): number {
  return toTotalSeconds(components) / 3600
}

/**
 * Calculate total days
 */
export function toTotalDays(components: DurationComponents): number {
  return toTotalSeconds(components) / (24 * 60 * 60)
}

/**
 * Calculate total weeks
 */
export function toTotalWeeks(components: DurationComponents): number {
  return toTotalSeconds(components) / (7 * 24 * 60 * 60)
}

/**
 * Convert total seconds to a human-readable string
 */
export function toHumanReadable(components: DurationComponents): string {
  const parts: string[] = []
  
  if (components.years) {
    parts.push(`${formatNumber(components.years)} ${components.years === 1 ? "year" : "years"}`)
  }
  if (components.months) {
    parts.push(`${formatNumber(components.months)} ${components.months === 1 ? "month" : "months"}`)
  }
  if (components.weeks) {
    parts.push(`${formatNumber(components.weeks)} ${components.weeks === 1 ? "week" : "weeks"}`)
  }
  if (components.days) {
    parts.push(`${formatNumber(components.days)} ${components.days === 1 ? "day" : "days"}`)
  }
  if (components.hours) {
    parts.push(`${formatNumber(components.hours)} ${components.hours === 1 ? "hour" : "hours"}`)
  }
  if (components.minutes) {
    parts.push(`${formatNumber(components.minutes)} ${components.minutes === 1 ? "minute" : "minutes"}`)
  }
  if (components.seconds) {
    parts.push(`${formatNumber(components.seconds)} ${components.seconds === 1 ? "second" : "seconds"}`)
  }
  
  if (parts.length === 0) {
    return "0 seconds"
  }
  
  if (parts.length === 1) {
    return parts[0]
  }
  
  if (parts.length === 2) {
    return parts.join(" and ")
  }
  
  return parts.slice(0, -1).join(", ") + ", and " + parts[parts.length - 1]
}

/**
 * Create duration from a total number of seconds
 */
export function fromSeconds(totalSeconds: number): DurationComponents {
  if (totalSeconds <= 0) {
    return { ...EMPTY_DURATION }
  }
  
  let remaining = totalSeconds
  
  const days = Math.floor(remaining / (24 * 60 * 60))
  remaining %= 24 * 60 * 60
  
  const hours = Math.floor(remaining / (60 * 60))
  remaining %= 60 * 60
  
  const minutes = Math.floor(remaining / 60)
  remaining %= 60
  
  const seconds = remaining
  
  return {
    years: 0,
    months: 0,
    weeks: 0,
    days,
    hours,
    minutes,
    seconds,
  }
}

/**
 * Calculate end date from start date and duration
 */
export function addDurationToDate(startDate: Date, components: DurationComponents): Date {
  const result = new Date(startDate)
  
  if (components.years) {
    result.setFullYear(result.getFullYear() + Math.floor(components.years))
    if (components.years % 1) {
      result.setTime(result.getTime() + (components.years % 1) * 365 * 24 * 60 * 60 * 1000)
    }
  }
  
  if (components.months) {
    result.setMonth(result.getMonth() + Math.floor(components.months))
    if (components.months % 1) {
      result.setTime(result.getTime() + (components.months % 1) * 30 * 24 * 60 * 60 * 1000)
    }
  }
  
  if (components.weeks) {
    result.setTime(result.getTime() + components.weeks * 7 * 24 * 60 * 60 * 1000)
  }
  
  if (components.days) {
    result.setTime(result.getTime() + components.days * 24 * 60 * 60 * 1000)
  }
  
  if (components.hours) {
    result.setTime(result.getTime() + components.hours * 60 * 60 * 1000)
  }
  
  if (components.minutes) {
    result.setTime(result.getTime() + components.minutes * 60 * 1000)
  }
  
  if (components.seconds) {
    result.setTime(result.getTime() + components.seconds * 1000)
  }
  
  return result
}

/**
 * Common duration presets
 */
export const DURATION_PRESETS = [
  { label: "1 Hour", value: "PT1H" },
  { label: "1 Day", value: "P1D" },
  { label: "1 Week", value: "P1W" },
  { label: "1 Month", value: "P1M" },
  { label: "1 Year", value: "P1Y" },
  { label: "30 Minutes", value: "PT30M" },
  { label: "90 Days", value: "P90D" },
  { label: "1 Year 6 Months", value: "P1Y6M" },
] as const
