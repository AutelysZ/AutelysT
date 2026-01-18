import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Signature Generator/Verifier - AutelysT",
  description:
    "Sign and verify messages with HMAC, RSA, ECDSA, and EdDSA using PEM/JWK keys and flexible encodings.",
  keywords: [
    "signature",
    "sign",
    "verify",
    "hmac",
    "rsa",
    "ecdsa",
    "eddsa",
    "ed25519",
    "pem",
    "jwk",
  ],
}

export default function SignatureLayout({ children }: { children: React.ReactNode }) {
  return children
}
