import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Password Generator - AutelysT",
  description: "Online password generator with Graphic ASCII, Base64/58/45/32/Hex formats, length presets, and one-click copy.",
  keywords: ["password generator", "secure password", "ascii", "base64", "base58", "base45", "base32", "hex", "length preset"],
}

export default function PasswordGeneratorLayout({ children }: { children: React.ReactNode }) {
  return children
}
