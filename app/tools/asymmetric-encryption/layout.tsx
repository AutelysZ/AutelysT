import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Asymmetric Encryption (RSA-OAEP) - AutelysT",
  description: "Encrypt and decrypt messages with RSA-OAEP using PEM/JWK keys, configurable hash, and keypair generation.",
  keywords: [
    "asymmetric encryption",
    "rsa-oaep",
    "public key encryption",
    "private key decryption",
    "pem",
    "jwk",
    "keypair",
    "web crypto",
  ],
}

export default function AsymmetricEncryptionLayout({ children }: { children: React.ReactNode }) {
  return children
}
