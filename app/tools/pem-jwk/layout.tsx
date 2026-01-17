import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "PEM/JWK Converter",
  description: "Convert cryptographic keys between PEM and JWK formats in the browser.",
  keywords: ["pem", "jwk", "converter", "key", "rsa", "ecdsa", "ed25519", "web crypto"],
}

export default function PemJwkLayout({ children }: { children: React.ReactNode }) {
  return children
}
