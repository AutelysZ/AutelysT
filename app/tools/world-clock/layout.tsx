import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "World Clock",
  description: "View multiple time zones with live or custom reference time.",
  keywords: ["world clock", "time zone", "time", "date", "global"],
}

export default function WorldClockLayout({ children }: { children: React.ReactNode }) {
  return children
}
