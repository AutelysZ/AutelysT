import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Number Format Converter",
  description:
    "Free online number format converter. Convert between different number representations including Chinese, Roman, and scientific notation.",
  keywords: ["number format", "thousand separator", "chinese numerals", "roman numerals", "scientific notation"],
}

export default function NumberFormatLayout({ children }: { children: React.ReactNode }) {
  return children
}
