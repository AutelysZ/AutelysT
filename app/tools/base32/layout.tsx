import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Base32 Encoder/Decoder",
  description: "Free online Base32 encoder and decoder. Used in TOTP authenticators and case-insensitive systems.",
  keywords: ["base32", "encoder", "decoder", "totp", "2fa"],
}

export default function Base32Layout({ children }: { children: React.ReactNode }) {
  return children
}
