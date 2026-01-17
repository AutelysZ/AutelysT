import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Symmetric Encryption - AutelysT",
  description: "Online symmetric encryption tool supporting AES (GCM), ChaCha20-Poly1305, Salsa20, Twofish, Blowfish, DES, and 3DES with PBKDF2/HKDF.",
  keywords: ["symmetric encryption", "decrypt", "aes", "chacha20", "salsa20", "twofish", "blowfish", "des", "3des", "pbkdf2", "hkdf"],
}

export default function SymmetricCryptoLayout({ children }: { children: React.ReactNode }) {
  return children
}
