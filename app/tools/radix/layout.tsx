import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Base Converter (Radix) - AutelysT",
  description: "Online base converter for binary, octal, decimal, hex, base60, and custom radixes with padding and case options.",
  keywords: ["base converter", "radix converter", "binary", "octal", "decimal", "hexadecimal", "base60", "custom base"],
}

export default function RadixLayout({ children }: { children: React.ReactNode }) {
  return children
}
