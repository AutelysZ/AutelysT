import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "JWK Converter - AutelysT",
  description: "Online JWK converter with PEM (SPKI/PKCS8) support, RSA/EC/OKP auto-detection, and file handling.",
  keywords: ["pem", "jwk", "pem to jwk", "jwk to pem", "rsa", "ec", "okp", "key converter"],
}

export default function PemJwkLayout({ children }: { children: React.ReactNode }) {
  return children
}
