import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "UUID - AutelysT",
  description:
    "Generate and parse UUIDs v1, v4, v6, and v7. View timestamp, node ID, and other version-specific fields.",
  keywords: ["uuid", "guid", "generator", "parser", "v1", "v4", "v6", "v7", "timestamp"],
}

export default function UUIDLayout({ children }: { children: React.ReactNode }) {
  return children
}
