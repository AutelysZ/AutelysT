import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Hex Escape Encoder/Decoder",
  description: "Free online Hex escape sequence encoder and decoder. Convert to and from \\xff format.",
  keywords: ["hex escape", "encoder", "decoder", "byte sequence"],
}

export default function HexEscapeLayout({ children }: { children: React.ReactNode }) {
  return children
}
