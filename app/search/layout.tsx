import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Search Tools",
  description:
    "Search and browse all available tools in AutelysT. Find encoding, decoding, number conversion, and other utilities.",
  keywords: ["tool search", "web tools", "online utilities"],
}

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children
}
