import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "ISO 8601 Duration Parser & Builder - AutelysT",
  description: "Parse and build ISO 8601 duration strings with real-time conversion, human-readable output, and date calculations.",
  keywords: ["iso 8601", "duration", "parser", "builder", "time interval", "period", "P1Y2M3D", "PT1H30M"],
}

export default function DurationLayout({ children }: { children: React.ReactNode }) {
  return children
}
