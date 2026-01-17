import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "ULID Generator/Parser - AutelysT",
  description: "Online ULID generator and parser with timestamp and randomness extraction.",
  keywords: ["ulid", "ulid generator", "ulid parser", "sortable identifier", "timestamp"],
}

export default function ULIDLayout({ children }: { children: React.ReactNode }) {
  return children
}
