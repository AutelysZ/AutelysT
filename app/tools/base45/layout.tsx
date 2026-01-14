import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Base45 Encoder/Decoder",
  description: "Free online Base45 encoder and decoder. Used in QR codes and EU Digital COVID Certificates.",
  keywords: ["base45", "encoder", "decoder", "qr code", "covid certificate"],
}

export default function Base45Layout({ children }: { children: React.ReactNode }) {
  return children
}
