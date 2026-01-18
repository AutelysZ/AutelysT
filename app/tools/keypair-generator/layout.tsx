import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Keypair Generator - AutelysT",
  description:
    "Online keypair generator for RSA, EC (secp256k1/Brainpool/P-256), Schnorr, EdDSA, and X25519/X448 with PEM/JWK export.",
  keywords: [
    "keypair generator",
    "rsa",
    "ecdsa",
    "ecdh",
    "schnorr",
    "secp256k1",
    "brainpool",
    "eddsa",
    "x25519",
    "x448",
    "jwk",
    "pem",
  ],
}

export default function KeypairGeneratorLayout({ children }: { children: React.ReactNode }) {
  return children
}
