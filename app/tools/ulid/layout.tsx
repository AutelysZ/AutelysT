import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "ULID - AutelysT",
  description:
    "Generate and parse ULIDs (Universally Unique Lexicographically Sortable Identifiers). Extract timestamp and randomness.",
  keywords: ["ulid", "generator", "parser", "timestamp", "sortable", "unique identifier"],
}

export default function ULIDLayout({ children }: { children: React.ReactNode }) {
  return children
}
