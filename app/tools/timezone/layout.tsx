import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Time Zone Converter - AutelysT",
  description:
    "Free online time zone converter. Convert times between different time zones with Unix epoch timestamp support (seconds, milliseconds, microseconds, nanoseconds). Supports all IANA time zones.",
  keywords: [
    "timezone converter",
    "time zone",
    "unix timestamp",
    "epoch converter",
    "datetime converter",
    "utc converter",
  ],
}

export default function TimezoneLayout({ children }: { children: React.ReactNode }) {
  return children
}
