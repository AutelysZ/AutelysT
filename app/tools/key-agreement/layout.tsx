import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Key Agreement (ECDH/X25519/ML-KEM) - AutelysT",
  description:
    "Derive shared secrets with ECDH, X25519/X448, or ML-KEM/hybrid KEMs plus optional HKDF/PBKDF2 key derivation.",
  keywords: [
    "key agreement",
    "ecdh",
    "secp256k1",
    "schnorr",
    "x25519",
    "x448",
    "shared secret",
    "ml-kem",
    "kyber",
    "xwing",
    "post-quantum",
    "hkdf",
    "pbkdf2",
    "pem",
    "jwk",
  ],
}

export default function KeyAgreementLayout({ children }: { children: React.ReactNode }) {
  return children
}
