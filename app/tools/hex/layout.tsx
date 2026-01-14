import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Hex (Base16) Encoder/Decoder",
  description: "Free online Hexadecimal encoder and decoder. Convert text to hex and hex to text.",
  keywords: ["hex", "hexadecimal", "base16", "encoder", "decoder"],
}

export default function HexLayout({ children }: { children: React.ReactNode }) {
  return children
}
