import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Signature Generator/Verifier - AutelysT",
  description:
    "Sign and verify messages with HMAC, RSA, ECDSA, EdDSA, Schnorr, ML-DSA, and SLH-DSA using PEM/JWK/PQC JSON keys.",
  keywords: [
    "signature",
    "sign",
    "verify",
    "hmac",
    "rsa",
    "ecdsa",
    "eddsa",
    "schnorr",
    "secp256k1",
    "brainpool",
    "ed25519",
    "ed448",
    "ml-dsa",
    "slh-dsa",
    "dilithium",
    "sphincs",
    "pqc",
    "pem",
    "jwk",
  ],
}

export default function SignatureLayout({ children }: { children: React.ReactNode }) {
  return children
}
