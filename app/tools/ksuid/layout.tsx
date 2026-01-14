import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "KSUID - AutelysT",
  description: "Generate and parse KSUIDs (K-Sortable Unique Identifiers). Extract timestamp and payload information.",
  keywords: ["ksuid", "generator", "parser", "timestamp", "sortable", "unique identifier"],
}

export default function KSUIDLayout({ children }: { children: React.ReactNode }) {
  return children
}
