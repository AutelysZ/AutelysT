import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Base45 Encoder/Decoder - AutelysT",
  description: "Online Base45 encoder/decoder for QR payloads and EU Digital COVID Certificates.",
  keywords: ["base45", "encoder", "decoder", "qr", "digital covid certificate", "dcc"],
}

export default function Base45Layout({ children }: { children: React.ReactNode }) {
  return children
}
