import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Keypair Generator",
  description: "Generate RSA, ECDSA, ECDH, and EdDSA keypairs with PEM and JWK exports.",
  keywords: ["keypair", "rsa", "ecdsa", "ecdh", "eddsa", "jwk", "pem", "web crypto"],
}

export default function KeypairGeneratorLayout({ children }: { children: React.ReactNode }) {
  return children
}
