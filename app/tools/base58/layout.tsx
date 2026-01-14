import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Base58 Encoder/Decoder",
  description: "Free online Base58 encoder and decoder. Used in Bitcoin, IPFS, and cryptocurrency addresses.",
  keywords: ["base58", "encoder", "decoder", "bitcoin", "cryptocurrency"],
}

export default function Base58Layout({ children }: { children: React.ReactNode }) {
  return children
}
