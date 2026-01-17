import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Base64 Encoder/Decoder - AutelysT",
  description: "Online Base64 encoder/decoder with URL-safe mode, MIME line breaks, 100+ text encodings, and file input.",
  keywords: ["base64", "encoder", "decoder", "url-safe", "mime", "text encoding", "file to base64"],
}

export default function Base64Layout({ children }: { children: React.ReactNode }) {
  return children
}
