import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Base36 Encoder/Decoder",
  description: "Free online Base36 encoder and decoder. Convert text to alphanumeric representation.",
  keywords: ["base36", "encoder", "decoder", "alphanumeric"],
}

export default function Base36Layout({ children }: { children: React.ReactNode }) {
  return children
}
