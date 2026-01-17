import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Hash (Digest)",
  description: "Generate cryptographic digests using MD, SHA, SHA3, and BLAKE algorithms.",
  keywords: ["hash", "digest", "md5", "sha", "sha3", "blake", "checksum"],
}

export default function HashLayout({ children }: { children: React.ReactNode }) {
  return children
}
