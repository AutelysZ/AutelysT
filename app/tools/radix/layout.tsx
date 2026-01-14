import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Radix/Base Converter",
  description:
    "Free online number base converter. Convert between binary, octal, decimal, hexadecimal, base60, and custom bases.",
  keywords: ["radix converter", "base converter", "binary", "hexadecimal", "octal"],
}

export default function RadixLayout({ children }: { children: React.ReactNode }) {
  return children
}
