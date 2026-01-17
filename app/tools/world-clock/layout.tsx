import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "World Clock - AutelysT",
  description: "Online world clock with multiple time zones, live updates, and custom reference time.",
  keywords: ["world clock", "time zone", "global time", "live clock", "time zones"],
}

export default function WorldClockLayout({ children }: { children: React.ReactNode }) {
  return children
}
