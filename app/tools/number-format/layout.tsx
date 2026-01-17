import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Number Format Converter - AutelysT",
  description: "Online number format converter for Chinese numerals, Roman numerals, scientific/engineering notation, and grouping.",
  keywords: ["number format", "chinese numerals", "roman numerals", "scientific notation", "engineering notation", "thousand separator"],
}

export default function NumberFormatLayout({ children }: { children: React.ReactNode }) {
  return children
}
