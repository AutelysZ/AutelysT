import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Base64 Encoder/Decoder",
  description:
    "Free online Base64 encoder and decoder. Supports UTF-8, URL-safe mode, MIME format, and 100+ text encodings.",
  keywords: ["base64", "encoder", "decoder", "online tool", "utf-8", "url-safe"],
}

export default function Base64Layout({ children }: { children: React.ReactNode }) {
  return children
}
