import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Password Generator - AutelysT",
  description:
    "Generate secure passwords with Graphic ASCII, Base64, Hex, Base58, Base45, or Base32 serialization and length presets.",
  keywords: ["password generator", "secure password", "base64", "hex", "base58", "base45", "base32", "ascii"],
}

export default function PasswordGeneratorLayout({ children }: { children: React.ReactNode }) {
  return children
}
