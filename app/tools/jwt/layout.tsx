import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "JWT Parser/Generator - AutelysT",
  description: "Online JWT parser and generator with claims editor, HMAC/PEM signature validation, and header/payload editing.",
  keywords: ["jwt", "json web token", "jwt parser", "jwt generator", "claims", "signature", "hmac", "rsa", "ecdsa"],
}

export default function JwtLayout({ children }: { children: React.ReactNode }) {
  return children
}
