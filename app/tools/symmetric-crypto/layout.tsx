import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Symmetric Crypto",
  description: "Encrypt or decrypt data using AES, ChaCha20, Salsa20, or DES.",
  keywords: ["symmetric", "encrypt", "decrypt", "aes", "chacha20", "salsa20", "des"],
}

export default function SymmetricCryptoLayout({ children }: { children: React.ReactNode }) {
  return children
}
