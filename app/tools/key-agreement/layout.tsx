import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Key Agreement (ECDH/X25519) - AutelysT",
  description:
    "Derive shared secrets with ECDH or X25519/X448, plus optional HKDF/PBKDF2 key derivation and flexible encodings.",
  keywords: [
    "key agreement",
    "ecdh",
    "secp256k1",
    "schnorr",
    "x25519",
    "x448",
    "shared secret",
    "hkdf",
    "pbkdf2",
    "pem",
    "jwk",
  ],
}

export default function KeyAgreementLayout({ children }: { children: React.ReactNode }) {
  return children
}
