import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Keypair Generator - AutelysT",
  description: "Online keypair generator with Web Crypto parameters, key usages, and PEM/JWK export.",
  keywords: ["keypair generator", "rsa", "ecdsa", "ecdh", "eddsa", "jwk", "pem", "web crypto"],
}

export default function KeypairGeneratorLayout({ children }: { children: React.ReactNode }) {
  return children
}
